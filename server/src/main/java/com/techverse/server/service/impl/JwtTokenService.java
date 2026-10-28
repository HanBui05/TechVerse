package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.entity.AuthSession;
import com.techverse.server.entity.Token;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import com.techverse.server.properties.JwtProperties;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.AuthSessionRepository;
import com.techverse.server.service.TokenService;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService implements TokenService {

	private static final String USER_TOKENS_KEY_PREFIX = "auth:user-tokens:";
	private static final String USER_SESSIONS_KEY_PREFIX = "auth:user-sessions:";
	private static final String SESSION_TOKENS_KEY_PREFIX = "auth:session-tokens:";

	private final JwtEncoder jwtEncoder;
	private final JwtProperties jwtProperties;
	private final TokenRepository tokenRepository;
	private final AuthSessionRepository sessionRepository;
	private final StringRedisTemplate stringRedisTemplate;
	private final JwtDecoder refreshTokenDecoder;

	public JwtTokenService(
			JwtEncoder jwtEncoder,
			JwtProperties jwtProperties,
			TokenRepository tokenRepository,
			AuthSessionRepository sessionRepository,
			StringRedisTemplate stringRedisTemplate,
			@Qualifier("refreshTokenDecoder") JwtDecoder refreshTokenDecoder
	) {
		this.jwtEncoder = jwtEncoder;
		this.jwtProperties = jwtProperties;
		this.tokenRepository = tokenRepository;
		this.sessionRepository = sessionRepository;
		this.stringRedisTemplate = stringRedisTemplate;
		this.refreshTokenDecoder = refreshTokenDecoder;
	}

	@Override
	public JwtDetails generateAccessToken(UUID userId, Set<RoleName> roles, String sessionId) {
		return generateToken(userId, roles, sessionId, TokenType.ACCESS, jwtProperties.accessTokenExpiration());
	}

	@Override
	public JwtDetails generateRefreshToken(UUID userId, Set<RoleName> roles, String sessionId) {
		return generateToken(userId, roles, sessionId, TokenType.REFRESH, jwtProperties.refreshTokenExpiration());
	}

	@Override
	public void createSession(UUID userId, JwtDetails refreshToken) {
		// Cover access issued just before refresh expiry without extending refresh validity.
		Instant expiresAt = refreshToken.getExpiresAt().plus(jwtProperties.accessTokenExpiration());
		sessionRepository.save(AuthSession.builder()
				.id(refreshToken.getSessionId())
				.userId(userId.toString())
				.refreshJwtId(refreshToken.getJwtId())
				.createdAt(Instant.now())
				.expiresAt(expiresAt)
				.timeToLive(Math.max(1, Duration.between(Instant.now(), expiresAt).toSeconds()))
				.build());
		index(USER_SESSIONS_KEY_PREFIX + userId, refreshToken.getSessionId(), expiresAt);
	}

	@Override
	public void saveToken(JwtDetails token, UUID userId, TokenType tokenType) {
		tokenRepository.save(Token.builder()
				.jwtId(token.getJwtId())
				.userId(userId.toString())
				.sessionId(token.getSessionId())
				.tokenType(tokenType)
				.timeToLive(token.getSecondsTtl())
				.build());
		index(userTokenKey(userId), token.getJwtId(), token.getExpiresAt());
		index(SESSION_TOKENS_KEY_PREFIX + token.getSessionId(), token.getJwtId(), token.getExpiresAt());
	}

	@Override
	public Jwt decodeRefreshToken(String rawRefreshToken) {
		return refreshTokenDecoder.decode(rawRefreshToken);
	}

	@Override
	public boolean isTokenActive(Jwt jwt, TokenType tokenType) {
		String sessionId = jwt.getClaimAsString("sid");
		if (jwt.getId() == null || jwt.getSubject() == null || sessionId == null || sessionId.isBlank()) {
			return false;
		}
		return tokenRepository.findById(jwt.getId())
				.filter(token -> token.getTokenType() == tokenType)
				.filter(token -> jwt.getSubject().equals(token.getUserId()))
				.filter(token -> sessionId.equals(token.getSessionId()))
				.flatMap(token -> sessionRepository.findById(sessionId))
				.filter(session -> jwt.getSubject().equals(session.getUserId()))
				.filter(session -> session.getExpiresAt() != null && session.getExpiresAt().isAfter(Instant.now()))
				.filter(session -> tokenType != TokenType.REFRESH || jwt.getId().equals(session.getRefreshJwtId()))
				.isPresent();
	}

	@Override
	public void deleteSession(UUID userId, String sessionId) {
		if (sessionId == null || sessionId.isBlank()) {
			return;
		}
		if (sessionRepository.findById(sessionId)
				.filter(session -> !userId.toString().equals(session.getUserId())).isPresent()) {
			return;
		}
		// Revocation is authoritative even if subsequent token cleanup fails.
		sessionRepository.deleteById(sessionId);
		String sessionTokenKey = SESSION_TOKENS_KEY_PREFIX + sessionId;
		Set<String> tokenIds = stringRedisTemplate.opsForZSet().range(sessionTokenKey, 0, -1);
		if (tokenIds != null) {
			tokenIds.forEach(this::deleteToken);
		}
		stringRedisTemplate.delete(sessionTokenKey);
		removeFromIndex(USER_SESSIONS_KEY_PREFIX + userId, sessionId);
	}

	@Override
	public void deleteToken(String jwtId) {
		tokenRepository.findById(jwtId).ifPresent(token -> {
			tokenRepository.delete(token);
			removeFromIndex(userTokenKey(token.getUserId()), jwtId);
			if (token.getSessionId() != null) {
				removeFromIndex(SESSION_TOKENS_KEY_PREFIX + token.getSessionId(), jwtId);
			}
		});
	}

	@Override
	public void deleteAllTokensByUserId(UUID userId) {
		// Caller holds the user row lock, shared with login, refresh and logout.
		String sessionsKey = USER_SESSIONS_KEY_PREFIX + userId;
		Set<String> sessionIds = stringRedisTemplate.opsForZSet().range(sessionsKey, 0, -1);
		if (sessionIds != null && !sessionIds.isEmpty()) {
			sessionRepository.deleteAllById(sessionIds);
			for (String sessionId : sessionIds) {
				stringRedisTemplate.delete(SESSION_TOKENS_KEY_PREFIX + sessionId);
			}
		}
		stringRedisTemplate.delete(sessionsKey);
		String userTokenKey = userTokenKey(userId);
		stringRedisTemplate.opsForZSet().removeRangeByScore(userTokenKey, 0, Instant.now().toEpochMilli());
		Set<String> tokenIds = stringRedisTemplate.opsForZSet().range(userTokenKey, 0, -1);
		if (tokenIds != null && !tokenIds.isEmpty()) {
			tokenRepository.deleteAllById(tokenIds);
		}
		stringRedisTemplate.delete(userTokenKey);
	}

	private void index(String key, String member, Instant expiresAt) {
		stringRedisTemplate.opsForZSet().removeRangeByScore(key, 0, Instant.now().toEpochMilli());
		stringRedisTemplate.opsForZSet().add(key, member, expiresAt.toEpochMilli());
		Long currentTtl = stringRedisTemplate.getExpire(key, TimeUnit.MILLISECONDS);
		long remainingMillis = Duration.between(Instant.now(), expiresAt).toMillis();
		// All production mutations share a user row lock. Never shorten a live index.
		if (currentTtl == null || currentTtl < remainingMillis) {
			stringRedisTemplate.expireAt(key, expiresAt);
		}
	}

	private void removeFromIndex(String key, String member) {
		stringRedisTemplate.opsForZSet().remove(key, member);
		stringRedisTemplate.opsForZSet().removeRangeByScore(key, 0, Instant.now().toEpochMilli());
		Long size = stringRedisTemplate.opsForZSet().size(key);
		if (size != null && size == 0) {
			stringRedisTemplate.delete(key);
		}
	}

	private String userTokenKey(UUID userId) {
		return USER_TOKENS_KEY_PREFIX + userId;
	}

	private String userTokenKey(String userId) {
		return USER_TOKENS_KEY_PREFIX + userId;
	}

	private JwtDetails generateToken(UUID userId, Set<RoleName> roles, String sessionId, TokenType tokenType, Duration expiration) {
		Instant issuedAt = Instant.now();
		Instant expiresAt = issuedAt.plus(expiration);
		String jwtId = UUID.randomUUID().toString();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(jwtProperties.issuer())
				.subject(userId.toString())
				.issuedAt(issuedAt)
				.expiresAt(expiresAt)
				.id(jwtId)
				.claim("user_id", userId.toString())
				.claim("sid", sessionId)
				.claim("token_type", tokenType.name().toLowerCase())
				.claim("roles", roles.stream().map(RoleName::name).sorted().toList())
				.build();
		JwsHeader headers = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
		String token = jwtEncoder.encode(JwtEncoderParameters.from(headers, claims)).getTokenValue();

		return JwtDetails.builder()
				.value(token)
				.jwtId(jwtId)
				.sessionId(sessionId)
				.expiresAt(expiresAt)
				.secondsTtl(expiration.toSeconds())
				.build();
	}
}
