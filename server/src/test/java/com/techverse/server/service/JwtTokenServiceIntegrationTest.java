package com.techverse.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jwt.SignedJWT;
import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.entity.Token;
import com.techverse.server.entity.AuthSession;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.AuthSessionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.ApplicationContext;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@SpringBootTest(properties = {
		"jwt.secret-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		"jwt.issuer=https://api.techverse.local",
		"jwt.access-token-expiration=15m",
		"jwt.refresh-token-expiration=7d"
})
@ActiveProfiles("test")
class JwtTokenServiceIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

	@Container
	@ServiceConnection(name = "redis")
	static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
			.withExposedPorts(6379);

	@Autowired
	private ApplicationContext applicationContext;

	@Autowired
	private TokenService tokenService;

	@Autowired
	@Qualifier("accessTokenDecoder")
	private JwtDecoder jwtDecoder;

	@Autowired
	private TokenRepository tokenRepository;

	@Autowired
	private AuthSessionRepository sessionRepository;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@Test
	void savingShortLivedAccessDoesNotHideLongLivedSessionsFromRevocation() {
		UUID userId = UUID.randomUUID();
		String sid = UUID.randomUUID().toString();
		JwtDetails refresh = tokenService.generateRefreshToken(userId, Set.of(), sid);
		tokenService.createSession(userId, refresh);
		tokenService.saveToken(refresh, userId, TokenType.REFRESH);
		JwtDetails access = tokenService.generateAccessToken(userId, Set.of(RoleName.LEARNER), sid);
		tokenService.saveToken(access, userId, TokenType.ACCESS);

		assertThat(redisTemplate.getExpire("auth:user-tokens:" + userId)).isGreaterThan(600000L);
		assertThat(redisTemplate.getExpire("auth:session-tokens:" + sid)).isGreaterThan(600000L);
		assertThat(redisTemplate.getExpire("auth:user-sessions:" + userId)).isGreaterThan(600000L);
		tokenService.deleteAllTokensByUserId(userId);
		assertThat(sessionRepository.findById(sid)).isEmpty();
		assertThat(tokenRepository.findById(refresh.getJwtId())).isEmpty();
		assertThatThrownBy(() -> jwtDecoder.decode(access.getValue())).isInstanceOf(JwtValidationException.class);
	}

	@Test
	void sessionLifetimeCoversAccessIssuedNearTheOriginalRefreshExpiry() {
		UUID userId = UUID.randomUUID();
		String sid = UUID.randomUUID().toString();
		JwtDetails nearExpiryRefresh = JwtDetails.builder()
				.jwtId(UUID.randomUUID().toString()).sessionId(sid)
				.expiresAt(Instant.now().plusSeconds(10)).secondsTtl(10).build();
		tokenService.createSession(userId, nearExpiryRefresh);
		JwtDetails access = tokenService.generateAccessToken(userId, Set.of(RoleName.LEARNER), sid);
		tokenService.saveToken(access, userId, TokenType.ACCESS);

		AuthSession session = sessionRepository.findById(sid).orElseThrow();
		assertThat(session.getExpiresAt()).isAfter(access.getExpiresAt());
		assertThat(Duration.between(nearExpiryRefresh.getExpiresAt(), session.getExpiresAt()))
				.isEqualTo(Duration.ofMinutes(15));
		assertThat(jwtDecoder.decode(access.getValue()).getId()).isEqualTo(access.getJwtId());
	}

	@Test
	void legacyAccessWithoutSidIsRejectedEvenIfItsRedisRecordExists() {
		UUID userId = UUID.randomUUID();
		String jwtId = UUID.randomUUID().toString();
		JwtClaimsSet claims = JwtClaimsSet.builder().issuer("https://api.techverse.local")
				.subject(userId.toString()).id(jwtId).issuedAt(Instant.now())
				.expiresAt(Instant.now().plusSeconds(900)).claim("token_type", "access")
				.claim("roles", Set.of("LEARNER")).build();
		String raw = applicationContext.getBean(JwtEncoder.class).encode(JwtEncoderParameters.from(
				JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
		tokenRepository.save(Token.builder().jwtId(jwtId).userId(userId.toString())
				.tokenType(TokenType.ACCESS).timeToLive(900).build());

		assertThat(tokenRepository.findById(jwtId)).isPresent();
		assertThatThrownBy(() -> jwtDecoder.decode(raw)).isInstanceOf(JwtValidationException.class);
	}

	@Test
	void accessCannotBorrowAnotherSessionsTokenRecordOrOwner() {
		UUID userId = UUID.randomUUID();
		String sid = UUID.randomUUID().toString();
		JwtDetails refresh = tokenService.generateRefreshToken(userId, Set.of(), sid);
		tokenService.createSession(userId, refresh);
		JwtDetails access = tokenService.generateAccessToken(userId, Set.of(RoleName.LEARNER), sid);
		tokenService.saveToken(access, userId, TokenType.ACCESS);
		Token record = tokenRepository.findById(access.getJwtId()).orElseThrow();
		record.setSessionId(UUID.randomUUID().toString());
		tokenRepository.save(record);
		assertThatThrownBy(() -> jwtDecoder.decode(access.getValue())).isInstanceOf(JwtValidationException.class);

		record.setSessionId(sid);
		tokenRepository.save(record);
		AuthSession original = sessionRepository.findById(sid).orElseThrow();
		sessionRepository.save(AuthSession.builder().id(sid).userId(UUID.randomUUID().toString())
				.refreshJwtId(refresh.getJwtId()).createdAt(original.getCreatedAt())
				.expiresAt(original.getExpiresAt()).timeToLive(original.getTimeToLive()).build());
		assertThatThrownBy(() -> jwtDecoder.decode(access.getValue())).isInstanceOf(JwtValidationException.class);
	}

	@Test
	void exposesJwtEncoderAndTokenService() {
		assertThat(applicationContext.getBeansOfType(JwtEncoder.class)).hasSize(1);
		assertThat(applicationContext.containsBean("jwtTokenService")).isTrue();
	}

	@Test
	void generatesSignedAccessTokenWithAuthenticationClaims() {
		UUID userId = UUID.randomUUID();
		String sessionId = UUID.randomUUID().toString();
		JwtDetails accessToken = tokenService.generateAccessToken(userId, Set.of(RoleName.AUTHOR, RoleName.LEARNER), sessionId);
		tokenService.createSession(userId, tokenService.generateRefreshToken(userId, Set.of(), sessionId));
		tokenService.saveToken(accessToken, userId, TokenType.ACCESS);

		Jwt decodedToken = jwtDecoder.decode(accessToken.getValue());
		assertThat(decodedToken.getSubject()).isEqualTo(userId.toString());
		assertThat(decodedToken.getClaimAsString("user_id")).isEqualTo(userId.toString());
		assertThat(decodedToken.getClaimAsString("sid")).isEqualTo(sessionId);
		assertThat(decodedToken.getIssuer().toString()).isEqualTo("https://api.techverse.local");
		assertThat(decodedToken.getClaimAsString("token_type")).isEqualTo("access");
		assertThat(decodedToken.getClaimAsStringList("roles")).containsExactly("AUTHOR", "LEARNER");
		assertThat(accessToken.getExpiresAt()).isAfter(Instant.now());
	}

	@Test
	void generatesSignedRefreshTokenWithRefreshClaims() throws Exception {
		UUID userId = UUID.randomUUID();
		JwtDetails refreshToken = tokenService.generateRefreshToken(userId, Set.of(RoleName.LEARNER), UUID.randomUUID().toString());

		SignedJWT decodedToken = SignedJWT.parse(refreshToken.getValue());
		assertThat(decodedToken.getJWTClaimsSet().getSubject()).isEqualTo(userId.toString());
		assertThat(decodedToken.getJWTClaimsSet().getStringClaim("token_type")).isEqualTo("refresh");
		assertThat(refreshToken.getExpiresAt()).isAfter(Instant.now());
	}

	@Test
	void storesAccessAndRefreshTokensAsSeparateRedisRecordsWithTtl() {
		UUID userId = UUID.randomUUID();
		String sessionId = UUID.randomUUID().toString();
		JwtDetails accessToken = tokenService.generateAccessToken(userId, Set.of(RoleName.LEARNER), sessionId);
		JwtDetails refreshToken = tokenService.generateRefreshToken(userId, Set.of(RoleName.LEARNER), sessionId);
		tokenService.createSession(userId, refreshToken);

		tokenService.saveToken(accessToken, userId, TokenType.ACCESS);
		tokenService.saveToken(refreshToken, userId, TokenType.REFRESH);

		Token storedAccessToken = tokenRepository.findById(accessToken.getJwtId()).orElseThrow();
		Token storedRefreshToken = tokenRepository.findById(refreshToken.getJwtId()).orElseThrow();
		assertThat(storedAccessToken.getUserId()).isEqualTo(userId.toString());
		assertThat(storedAccessToken.getSessionId()).isEqualTo(sessionId);
		assertThat(storedAccessToken.getTokenType()).isEqualTo(TokenType.ACCESS);
		assertThat(storedAccessToken.getTimeToLive()).isPositive().isLessThanOrEqualTo(900);
		assertThat(storedRefreshToken.getTokenType()).isEqualTo(TokenType.REFRESH);
		assertThat(storedRefreshToken.getTimeToLive()).isPositive().isLessThanOrEqualTo(604800);
	}

	@Test
	void rejectsAccessTokenAfterItsRedisRecordIsDeleted() {
		UUID userId = UUID.randomUUID();
		String sessionId = UUID.randomUUID().toString();
		JwtDetails accessToken = tokenService.generateAccessToken(userId, Set.of(RoleName.LEARNER), sessionId);
		tokenService.createSession(userId, tokenService.generateRefreshToken(userId, Set.of(), sessionId));
		tokenService.saveToken(accessToken, userId, TokenType.ACCESS);

		assertThat(jwtDecoder.decode(accessToken.getValue()).getId()).isEqualTo(accessToken.getJwtId());

		tokenService.deleteToken(accessToken.getJwtId());

		assertThatThrownBy(() -> jwtDecoder.decode(accessToken.getValue()))
				.isInstanceOf(JwtValidationException.class);
	}
}
