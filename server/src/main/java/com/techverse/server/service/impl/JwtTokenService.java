package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.entity.Token;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import com.techverse.server.properties.JwtProperties;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.service.TokenService;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
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

	private final JwtEncoder jwtEncoder;
	private final JwtProperties jwtProperties;
	private final TokenRepository tokenRepository;
	private final StringRedisTemplate stringRedisTemplate;
	private final JwtDecoder refreshTokenDecoder;
	private final JwtDecoder logoutTokenDecoder;

	public JwtTokenService(
			JwtEncoder jwtEncoder,
			JwtProperties jwtProperties,
			TokenRepository tokenRepository,
			StringRedisTemplate stringRedisTemplate,
			@Qualifier("refreshTokenDecoder") JwtDecoder refreshTokenDecoder,
			@Qualifier("logoutTokenDecoder") JwtDecoder logoutTokenDecoder
	) {
		this.jwtEncoder = jwtEncoder;
		this.jwtProperties = jwtProperties;
		this.tokenRepository = tokenRepository;
		this.stringRedisTemplate = stringRedisTemplate;
		this.refreshTokenDecoder = refreshTokenDecoder;
		this.logoutTokenDecoder = logoutTokenDecoder;
	}

	@Override
	public JwtDetails generateAccessToken(UUID userId, Set<RoleName> roles) {
		return generateToken(userId, roles, TokenType.ACCESS, jwtProperties.accessTokenExpiration());
	}

	@Override
	public JwtDetails generateRefreshToken(UUID userId, Set<RoleName> roles) {
		return generateToken(userId, roles, TokenType.REFRESH, jwtProperties.refreshTokenExpiration());
	}

	@Override
	public void saveToken(JwtDetails token, UUID userId, TokenType tokenType) {
		tokenRepository.save(Token.builder()
				.jwtId(token.getJwtId())
				.userId(userId.toString())
				.tokenType(tokenType)
				.timeToLive(token.getSecondsTtl())
				.build());
		String userTokenKey = userTokenKey(userId);
		stringRedisTemplate.opsForZSet().add(userTokenKey, token.getJwtId(), token.getExpiresAt().toEpochMilli());
		stringRedisTemplate.expireAt(userTokenKey, token.getExpiresAt());
	}

	@Override
	public Jwt decodeRefreshToken(String rawRefreshToken) {
		return refreshTokenDecoder.decode(rawRefreshToken);
	}

	@Override
	public Jwt decodeTokenForLogout(String rawToken) {
		return logoutTokenDecoder.decode(rawToken);
	}

	@Override
	public Optional<UUID> findUserId(String jwtId, TokenType tokenType) {
		return tokenRepository.findById(jwtId)
				.filter(token -> token.getTokenType() == tokenType)
				.flatMap(this::toUserId);
	}

	@Override
	public void deleteToken(String jwtId) {
		tokenRepository.findById(jwtId).ifPresent(token -> {
			tokenRepository.delete(token);
			String userTokenKey = userTokenKey(token.getUserId());
			stringRedisTemplate.opsForZSet().remove(userTokenKey, jwtId);
			Long remainingTokenCount = stringRedisTemplate.opsForZSet().size(userTokenKey);
			if (remainingTokenCount != null && remainingTokenCount == 0) {
				stringRedisTemplate.delete(userTokenKey);
			}
		});
	}

	@Override
	public void deleteAllTokensByUserId(UUID userId) {
		String userTokenKey = userTokenKey(userId);
		stringRedisTemplate.opsForZSet().removeRangeByScore(userTokenKey, 0, Instant.now().toEpochMilli());
		Set<String> tokenIds = stringRedisTemplate.opsForZSet().range(userTokenKey, 0, -1);
		if (tokenIds != null && !tokenIds.isEmpty()) {
			tokenRepository.deleteAllById(tokenIds);
		}
		stringRedisTemplate.delete(userTokenKey);
	}

	private Optional<UUID> toUserId(Token token) {
		try {
			return Optional.of(UUID.fromString(token.getUserId()));
		} catch (IllegalArgumentException exception) {
			return Optional.empty();
		}
	}

	private String userTokenKey(UUID userId) {
		return USER_TOKENS_KEY_PREFIX + userId;
	}

	private String userTokenKey(String userId) {
		return USER_TOKENS_KEY_PREFIX + userId;
	}

	private JwtDetails generateToken(UUID userId, Set<RoleName> roles, TokenType tokenType, Duration expiration) {
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
				.claim("token_type", tokenType.name().toLowerCase())
				.claim("roles", roles.stream().map(RoleName::name).sorted().toList())
				.build();
		JwsHeader headers = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
		String token = jwtEncoder.encode(JwtEncoderParameters.from(headers, claims)).getTokenValue();

		return JwtDetails.builder()
				.value(token)
				.jwtId(jwtId)
				.expiresAt(expiresAt)
				.secondsTtl(expiration.toSeconds())
				.build();
	}
}
