package com.techverse.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jwt.SignedJWT;
import com.techverse.server.entity.Token;
import com.techverse.server.entity.User;
import com.techverse.server.enums.TokenType;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.ObjectMapper;

@Testcontainers
@SpringBootTest(properties = {
		"jwt.secret-key=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		"jwt.issuer=https://api.techverse.local",
		"jwt.access-token-expiration=15m",
		"jwt.refresh-token-expiration=7d"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthLoginIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

	@Container
	@ServiceConnection(name = "redis")
	static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
			.withExposedPorts(6379);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private TokenRepository tokenRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private StringRedisTemplate stringRedisTemplate;

	@Autowired
	private OAuth2AuthorizedClientRepository oauth2AuthorizedClientRepository;

	private UUID loginUserId;

	@BeforeEach
	void setUpUser() {
		userRepository.deleteAll();
		User user = User.createLocalAccount(
				"Login Test User",
				"login.user@example.com",
				passwordEncoder.encode("SecurePass123!")
		);
		loginUserId = userRepository.saveAndFlush(user).getId();
	}

	@Test
	void logsInAndReturnsAccessTokenWithHttpOnlyRefreshCookie() throws Exception {
		String refreshCookie = mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", "login.user@example.com",
						"password", "SecurePass123!"
				))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(jsonPath("$.data.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.data.expiresIn").value(900))
				.andExpect(jsonPath("$.data.refreshToken").doesNotExist())
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh_token=")))
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("HttpOnly")))
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("SameSite=Lax")))
				.andReturn()
				.getResponse()
				.getHeader(HttpHeaders.SET_COOKIE);

		String rawRefreshToken = refreshCookie.split(";", 2)[0].split("=", 2)[1];
		SignedJWT decodedRefreshToken = SignedJWT.parse(rawRefreshToken);
		assertThat(decodedRefreshToken.getJWTClaimsSet().getStringClaim("token_type")).isEqualTo("refresh");
	}

	@Test
	void rejectsLoginWhenPasswordIsInvalid() throws Exception {
		mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", "login.user@example.com",
						"password", "WrongPassword123!"
				))))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_INVALID_CREDENTIALS"))
				.andExpect(jsonPath("$.error").value("Unauthorized"));
	}

	@Test
	void refreshesTokensAndRejectsTheRotatedRefreshToken() throws Exception {
		String initialRefreshToken = loginAndGetRefreshToken();
		SignedJWT initialRefreshJwt = SignedJWT.parse(initialRefreshToken);
		String initialRefreshJwtId = initialRefreshJwt.getJWTClaimsSet().getJWTID();

		String refreshedCookie = mockMvc.perform(post("/api/v1/auth/refresh")
				.cookie(new Cookie("refresh_token", initialRefreshToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(jsonPath("$.data.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.data.refreshToken").doesNotExist())
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh_token=")))
				.andReturn()
				.getResponse()
				.getHeader(HttpHeaders.SET_COOKIE);

		String refreshedRefreshToken = refreshedCookie.split(";", 2)[0].split("=", 2)[1];
		SignedJWT refreshedRefreshJwt = SignedJWT.parse(refreshedRefreshToken);
		String refreshedRefreshJwtId = refreshedRefreshJwt.getJWTClaimsSet().getJWTID();
		Token refreshedToken = tokenRepository.findById(refreshedRefreshJwtId).orElseThrow();
		assertThat(refreshedRefreshJwtId).isNotEqualTo(initialRefreshJwtId);
		assertThat(tokenRepository.findById(initialRefreshJwtId)).isEmpty();
		assertThat(refreshedToken.getTokenType()).isEqualTo(TokenType.REFRESH);

		mockMvc.perform(post("/api/v1/auth/refresh")
				.cookie(new Cookie("refresh_token", initialRefreshToken)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_INVALID_REFRESH_TOKEN"));
	}

	@Test
	void refreshesWithValidCookieWhenRequestContainsMalformedBearerHeader() throws Exception {
		String initialRefreshToken = loginAndGetRefreshToken();

		mockMvc.perform(post("/api/v1/auth/refresh")
				.header(HttpHeaders.AUTHORIZATION, "Bearer malformed-access-token")
				.cookie(new Cookie("refresh_token", initialRefreshToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(jsonPath("$.data.accessToken").isNotEmpty())
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh_token=")));
	}

	@Test
	void doesNotPersistGoogleProviderTokens() {
		OAuth2AuthenticationToken googleAuthentication = new OAuth2AuthenticationToken(
				new DefaultOAuth2User(
						List.of(new SimpleGrantedAuthority("ROLE_USER")),
						Map.of("sub", "google-subject-123"),
						"sub"
				),
				List.of(new SimpleGrantedAuthority("ROLE_USER")),
				"google"
		);
		OAuth2AuthorizedClient googleClient = new OAuth2AuthorizedClient(
				googleClientRegistration(),
				googleAuthentication.getName(),
				new OAuth2AccessToken(
						OAuth2AccessToken.TokenType.BEARER,
						"provider-access-token",
						Instant.now(),
						Instant.now().plusSeconds(300)
				),
				new OAuth2RefreshToken("provider-refresh-token", Instant.now())
		);
		MockHttpServletRequest request = new MockHttpServletRequest();

		oauth2AuthorizedClientRepository.saveAuthorizedClient(
				googleClient,
				googleAuthentication,
				request,
				new MockHttpServletResponse()
		);

		OAuth2AuthorizedClient storedClient = oauth2AuthorizedClientRepository.loadAuthorizedClient(
				"google",
				googleAuthentication,
				request
		);

		assertThat(storedClient).isNull();
	}

	@Test
	void doesNotCreateHttpSessionForRejectedApiRequest() throws Exception {
		MvcResult result = mockMvc.perform(get("/api/v1/private-resource"))
				.andExpect(status().isUnauthorized())
				.andReturn();

		assertThat(result.getRequest().getSession(false)).isNull();
	}

	@Test
	void indexesEveryTokenFromIndependentSessionsForTheSameUser() throws Exception {
		SessionTokens firstSession = loginAndGetSessionTokens();
		SessionTokens secondSession = loginAndGetSessionTokens();

		Set<String> indexedJwtIds = stringRedisTemplate.opsForZSet()
				.range(userTokenIndexKey(loginUserId), 0, -1);

		assertThat(indexedJwtIds).containsExactlyInAnyOrder(
				firstSession.accessJwtId(),
				firstSession.refreshJwtId(),
				secondSession.accessJwtId(),
				secondSession.refreshJwtId()
		);
		assertThat(tokenRepository.findById(firstSession.accessJwtId())).isPresent();
		assertThat(tokenRepository.findById(firstSession.refreshJwtId())).isPresent();
		assertThat(tokenRepository.findById(secondSession.accessJwtId())).isPresent();
		assertThat(tokenRepository.findById(secondSession.refreshJwtId())).isPresent();
	}

	@Test
	void logsOutOnlyTheCurrentSessionAndClearsItsRefreshCookie() throws Exception {
		SessionTokens firstSession = loginAndGetSessionTokens();
		SessionTokens secondSession = loginAndGetSessionTokens();

		mockMvc.perform(post("/api/v1/auth/logout")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + firstSession.accessToken())
				.cookie(new Cookie("refresh_token", firstSession.refreshToken())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("refresh_token=")))
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));

		assertThat(tokenRepository.findById(firstSession.accessJwtId())).isEmpty();
		assertThat(tokenRepository.findById(firstSession.refreshJwtId())).isEmpty();
		assertThat(tokenRepository.findById(secondSession.accessJwtId())).isPresent();
		assertThat(tokenRepository.findById(secondSession.refreshJwtId())).isPresent();
		assertThat(stringRedisTemplate.opsForZSet().range(userTokenIndexKey(loginUserId), 0, -1))
				.containsExactlyInAnyOrder(secondSession.accessJwtId(), secondSession.refreshJwtId());

	}

	@Test
	void returnsAnApiErrorWhenLogoutAccessTokenIsMissingOrInvalid() throws Exception {
		mockMvc.perform(post("/api/v1/auth/logout"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"))
				.andExpect(jsonPath("$.error").value("Unauthorized"));

		mockMvc.perform(post("/api/v1/auth/logout")
				.header(HttpHeaders.AUTHORIZATION, "Bearer malformed-access-token"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_INVALID_ACCESS_TOKEN"))
				.andExpect(jsonPath("$.error").value("Unauthorized"));
	}

	@Test
	void returnsAnApiErrorWhenAuthenticatedUserHasNoPermissionForAnEndpoint() throws Exception {
		SessionTokens session = loginAndGetSessionTokens();

		mockMvc.perform(post("/api/v1/private-resource")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + session.accessToken()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
				.andExpect(jsonPath("$.error").value("Forbidden"));
	}

	@Test
	void logsOutEverySessionForTheAuthenticatedUser() throws Exception {
		SessionTokens firstSession = loginAndGetSessionTokens();
		SessionTokens secondSession = loginAndGetSessionTokens();

		mockMvc.perform(post("/api/v1/auth/logout-all")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + firstSession.accessToken())
				.cookie(new Cookie("refresh_token", firstSession.refreshToken())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(header().string(HttpHeaders.SET_COOKIE, containsString("Max-Age=0")));

		assertThat(tokenRepository.findById(firstSession.accessJwtId())).isEmpty();
		assertThat(tokenRepository.findById(firstSession.refreshJwtId())).isEmpty();
		assertThat(tokenRepository.findById(secondSession.accessJwtId())).isEmpty();
		assertThat(tokenRepository.findById(secondSession.refreshJwtId())).isEmpty();
		assertThat(stringRedisTemplate.opsForZSet().range(userTokenIndexKey(loginUserId), 0, -1)).isEmpty();

		mockMvc.perform(post("/api/v1/auth/logout-all")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + secondSession.accessToken()))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(post("/api/v1/auth/refresh")
				.cookie(new Cookie("refresh_token", secondSession.refreshToken())))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_INVALID_REFRESH_TOKEN"));
	}

	private String loginAndGetRefreshToken() throws Exception {
		return loginAndGetSessionTokens().refreshToken();
	}

	private SessionTokens loginAndGetSessionTokens() throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", "login.user@example.com",
						"password", "SecurePass123!"
				))))
				.andExpect(status().isOk())
				.andReturn();
		String refreshCookie = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
		String refreshToken = refreshCookie.split(";", 2)[0].split("=", 2)[1];
		String accessToken = objectMapper.readTree(result.getResponse().getContentAsString())
				.at("/data/accessToken")
				.asText();
		return new SessionTokens(
				accessToken,
				refreshToken,
				SignedJWT.parse(accessToken).getJWTClaimsSet().getJWTID(),
				SignedJWT.parse(refreshToken).getJWTClaimsSet().getJWTID()
		);
	}

	private String userTokenIndexKey(UUID userId) {
		return "auth:user-tokens:" + userId;
	}

	private ClientRegistration googleClientRegistration() {
		return ClientRegistration.withRegistrationId("google")
				.clientId("test-client-id")
				.clientSecret("test-client-secret")
				.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
				.redirectUri("http://localhost:8080/login/oauth2/code/google")
				.authorizationUri("https://accounts.google.test/o/oauth2/v2/auth")
				.tokenUri("https://oauth2.googleapis.test/token")
				.userInfoUri("https://openidconnect.googleapis.test/userinfo")
				.userNameAttributeName("sub")
				.clientName("Google")
				.build();
	}

	private record SessionTokens(
			String accessToken,
			String refreshToken,
			String accessJwtId,
			String refreshJwtId
	) {
	}
}
