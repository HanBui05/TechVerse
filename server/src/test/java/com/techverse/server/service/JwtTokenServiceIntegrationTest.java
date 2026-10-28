package com.techverse.server.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jwt.SignedJWT;
import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.entity.Token;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import com.techverse.server.repository.TokenRepository;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.ApplicationContext;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
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

	@Test
	void exposesJwtEncoderAndTokenService() {
		assertThat(applicationContext.getBeansOfType(JwtEncoder.class)).hasSize(1);
		assertThat(applicationContext.containsBean("jwtTokenService")).isTrue();
	}

	@Test
	void generatesSignedAccessTokenWithAuthenticationClaims() {
		UUID userId = UUID.randomUUID();
		JwtDetails accessToken = tokenService.generateAccessToken(userId, Set.of(RoleName.AUTHOR, RoleName.LEARNER));
		tokenService.saveToken(accessToken, userId, TokenType.ACCESS);

		Jwt decodedToken = jwtDecoder.decode(accessToken.getValue());
		assertThat(decodedToken.getSubject()).isEqualTo(userId.toString());
		assertThat(decodedToken.getClaimAsString("user_id")).isEqualTo(userId.toString());
		assertThat(decodedToken.getIssuer().toString()).isEqualTo("https://api.techverse.local");
		assertThat(decodedToken.getClaimAsString("token_type")).isEqualTo("access");
		assertThat(decodedToken.getClaimAsStringList("roles")).containsExactly("AUTHOR", "LEARNER");
		assertThat(accessToken.getExpiresAt()).isAfter(Instant.now());
	}

	@Test
	void generatesSignedRefreshTokenWithRefreshClaims() throws Exception {
		UUID userId = UUID.randomUUID();
		JwtDetails refreshToken = tokenService.generateRefreshToken(userId, Set.of(RoleName.LEARNER));

		SignedJWT decodedToken = SignedJWT.parse(refreshToken.getValue());
		assertThat(decodedToken.getJWTClaimsSet().getSubject()).isEqualTo(userId.toString());
		assertThat(decodedToken.getJWTClaimsSet().getStringClaim("token_type")).isEqualTo("refresh");
		assertThat(refreshToken.getExpiresAt()).isAfter(Instant.now());
	}

	@Test
	void storesAccessAndRefreshTokensAsSeparateRedisRecordsWithTtl() {
		UUID userId = UUID.randomUUID();
		JwtDetails accessToken = tokenService.generateAccessToken(userId, Set.of(RoleName.LEARNER));
		JwtDetails refreshToken = tokenService.generateRefreshToken(userId, Set.of(RoleName.LEARNER));

		tokenService.saveToken(accessToken, userId, TokenType.ACCESS);
		tokenService.saveToken(refreshToken, userId, TokenType.REFRESH);

		Token storedAccessToken = tokenRepository.findById(accessToken.getJwtId()).orElseThrow();
		Token storedRefreshToken = tokenRepository.findById(refreshToken.getJwtId()).orElseThrow();
		assertThat(storedAccessToken.getUserId()).isEqualTo(userId.toString());
		assertThat(storedAccessToken.getTokenType()).isEqualTo(TokenType.ACCESS);
		assertThat(storedAccessToken.getTimeToLive()).isPositive().isLessThanOrEqualTo(900);
		assertThat(storedRefreshToken.getTokenType()).isEqualTo(TokenType.REFRESH);
		assertThat(storedRefreshToken.getTimeToLive()).isPositive().isLessThanOrEqualTo(604800);
	}

	@Test
	void rejectsAccessTokenAfterItsRedisRecordIsDeleted() {
		UUID userId = UUID.randomUUID();
		JwtDetails accessToken = tokenService.generateAccessToken(userId, Set.of(RoleName.LEARNER));
		tokenService.saveToken(accessToken, userId, TokenType.ACCESS);

		assertThat(jwtDecoder.decode(accessToken.getValue()).getId()).isEqualTo(accessToken.getJwtId());

		tokenService.deleteToken(accessToken.getJwtId());

		assertThatThrownBy(() -> jwtDecoder.decode(accessToken.getValue()))
				.isInstanceOf(JwtValidationException.class);
	}
}
