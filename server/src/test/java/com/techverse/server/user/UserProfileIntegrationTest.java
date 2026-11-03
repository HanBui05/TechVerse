package com.techverse.server.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.TokenService;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
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
class UserProfileIntegrationTest {

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
	private TokenService tokenService;

	private UUID profileUserId;

	@BeforeEach
	void setUpUser() {
		tokenRepository.deleteAll();
		userRepository.deleteAll();
		User user = User.createLocalAccount(
				"Profile Test User",
				"profile.user@example.com",
				passwordEncoder.encode("SecurePass123!"),
				"0912345678",
				LocalDate.of(2000, 5, 24)
		);
		profileUserId = userRepository.saveAndFlush(user).getId();
	}

	@Test
	void returnsOnlyTheAuthenticatedUsersProfile() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(jsonPath("$.message").value("Profile retrieved successfully"))
				.andExpect(jsonPath("$.data.id").value(profileUserId.toString()))
				.andExpect(jsonPath("$.data.fullName").value("Profile Test User"))
				.andExpect(jsonPath("$.data.email").value("profile.user@example.com"))
				.andExpect(jsonPath("$.data.phoneNumber").value("0912345678"))
				.andExpect(jsonPath("$.data.dateOfBirth").value("2000-05-24"))
				.andExpect(jsonPath("$.data.avatarUrl").value(nullValue()))
				.andExpect(jsonPath("$.data.roles[0]").value("LEARNER"))
				.andExpect(jsonPath("$.data.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.data.updatedAt").isNotEmpty())
				.andExpect(jsonPath("$.data.hasLocalPassword").value(true))
				.andExpect(jsonPath("$.data.password").doesNotExist())
				.andExpect(jsonPath("$.data.isActive").doesNotExist())
				.andExpect(jsonPath("$.data.createdBy").doesNotExist())
				.andExpect(jsonPath("$.data.updatedBy").doesNotExist());
	}

	@Test
	void rejectsProfileRequestWithoutAnAccessToken() throws Exception {
		mockMvc.perform(get("/api/v1/users/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
	}

	@Test
	void updatesTheAuthenticatedUsersProfileWithoutChangingCredentials() throws Exception {
		String accessToken = loginAndGetAccessToken();
		User originalUser = userRepository.findById(profileUserId).orElseThrow();
		String originalPassword = originalUser.getPassword();
		Instant originalUpdatedAt = originalUser.getUpdatedAt();

		MvcResult result = mockMvc.perform(patch("/api/v1/users/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of(
						"fullName", "Updated Profile User",
						"phoneNumber", "+84987654321",
						"dateOfBirth", "2001-04-20"
				))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(jsonPath("$.message").value("Profile updated successfully"))
				.andExpect(jsonPath("$.data.id").value(profileUserId.toString()))
				.andExpect(jsonPath("$.data.fullName").value("Updated Profile User"))
				.andExpect(jsonPath("$.data.email").value("profile.user@example.com"))
				.andExpect(jsonPath("$.data.phoneNumber").value("+84987654321"))
				.andExpect(jsonPath("$.data.dateOfBirth").value("2001-04-20"))
				.andReturn();

		User updatedUser = userRepository.findById(profileUserId).orElseThrow();
		Instant responseUpdatedAt = Instant.parse(objectMapper.readTree(result.getResponse().getContentAsString())
				.at("/data/updatedAt")
				.asText());
		assertThat(updatedUser.getEmail()).isEqualTo("profile.user@example.com");
		assertThat(updatedUser.getPassword()).isEqualTo(originalPassword);
		assertThat(updatedUser.getUpdatedBy()).isEqualTo(profileUserId);
		assertThat(responseUpdatedAt).isAfter(originalUpdatedAt);
	}

	@Test
	void rejectsProfileUpdateWithTooShortPhoneNumber() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(patch("/api/v1/users/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of("phoneNumber", "091234567"))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors.phoneNumber")
						.value("Phone number must contain between 10 and 20 digits"));
	}

	@Test
	void appliesMergePatchPerField() throws Exception {
		String accessToken = loginAndGetAccessToken();
		String originalHash = userRepository.findById(profileUserId).orElseThrow().getPassword();

		patchProfile(accessToken, "{\"phoneNumber\":null}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.fullName").value("Profile Test User"))
				.andExpect(jsonPath("$.data.phoneNumber").value(nullValue()))
				.andExpect(jsonPath("$.data.dateOfBirth").value("2000-05-24"));

		patchProfile(accessToken, "{\"phoneNumber\":\"0987654321\",\"dateOfBirth\":null}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.phoneNumber").value("0987654321"))
				.andExpect(jsonPath("$.data.dateOfBirth").value(nullValue()));

		patchProfile(accessToken, "{\"phoneNumber\":\"   \"}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.phoneNumber").value(nullValue()));

		patchProfile(accessToken, "{\"fullName\":\"Only Name Changed\",\"email\":\"x@example.com\",\"roles\":[\"ADMIN\"]}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.fullName").value("Only Name Changed"))
				.andExpect(jsonPath("$.data.email").value("profile.user@example.com"))
				.andExpect(jsonPath("$.data.roles[0]").value("LEARNER"));

		patchProfile(accessToken, "{}")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.fullName").value("Only Name Changed"))
				.andExpect(jsonPath("$.data.phoneNumber").value(nullValue()))
				.andExpect(jsonPath("$.data.dateOfBirth").value(nullValue()));

		User user = userRepository.findById(profileUserId).orElseThrow();
		assertThat(user.getEmail()).isEqualTo("profile.user@example.com");
		assertThat(user.getPassword()).isEqualTo(originalHash);
	}

	@Test
	void rejectsNullOrBlankFullName() throws Exception {
		String accessToken = loginAndGetAccessToken();

		for (String body : new String[] {"{\"fullName\":null}", "{\"fullName\":\"\"}", "{\"fullName\":\"   \"}"}) {
			patchProfile(accessToken, body)
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
					.andExpect(jsonPath("$.fieldErrors.fullName").exists());
		}
		assertThat(userRepository.findById(profileUserId).orElseThrow().getFullName()).isEqualTo("Profile Test User");
	}

	@Test
	void changesPasswordKeepsCurrentSessionAndRevokesOthers() throws Exception {
		Session current = login("SecurePass123!");
		Session other = login("SecurePass123!");

		changePassword(current.accessToken(), "SecurePass123!", "BrandNew456!", "BrandNew456!")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data").value(nullValue()))
				.andExpect(content().string(not(containsString("BrandNew456!"))));

		String storedHash = userRepository.findById(profileUserId).orElseThrow().getPassword();
		assertThat(storedHash).doesNotContain("BrandNew456!");
		assertThat(passwordEncoder.matches("BrandNew456!", storedHash)).isTrue();

		mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + current.accessToken()))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", current.refreshToken())))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + other.accessToken()))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", other.refreshToken())))
				.andExpect(status().isUnauthorized());

		loginRequest("SecurePass123!").andExpect(status().isUnauthorized());
		loginRequest("BrandNew456!").andExpect(status().isOk());
	}

	@Test
	void rejectsPasswordChangeWithoutAnAccessToken() throws Exception {
		mockMvc.perform(patch("/api/v1/users/me/password")
				.contentType(MediaType.APPLICATION_JSON)
				.content(passwordBody("SecurePass123!", "BrandNew456!", "BrandNew456!")))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
	}

	@Test
	void socialOnlyAccountCannotChangePassword() throws Exception {
		UUID socialId = userRepository.saveAndFlush(User.createSocialAccount("Social", "social.user@example.com")).getId();
		String sid = UUID.randomUUID().toString();
		JwtDetails refresh = tokenService.generateRefreshToken(socialId, Set.of(RoleName.LEARNER), sid);
		tokenService.createSession(socialId, refresh);
		JwtDetails access = tokenService.generateAccessToken(socialId, Set.of(RoleName.LEARNER), sid);
		tokenService.saveToken(access, socialId, TokenType.ACCESS);

		mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + access.getValue()))
				.andExpect(jsonPath("$.data.hasLocalPassword").value(false));
		changePassword(access.getValue(), "anything123", "BrandNew456!", "BrandNew456!")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("AUTH_PASSWORD_CHANGE_UNAVAILABLE"));
		assertThat(userRepository.findById(socialId).orElseThrow().getPassword()).isNull();
	}

	@Test
	void rateLimitsWrongCurrentPasswordAfterFiveFailures() throws Exception {
		String accessToken = loginAndGetAccessToken();
		String originalHash = userRepository.findById(profileUserId).orElseThrow().getPassword();

		for (int i = 0; i < 5; i++) {
			changePassword(accessToken, "WrongPass999!", "BrandNew456!", "BrandNew456!")
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("AUTH_CURRENT_PASSWORD_INCORRECT"));
		}
		// Correct current password still blocked: the limit is checked before comparing.
		changePassword(accessToken, "SecurePass123!", "BrandNew456!", "BrandNew456!")
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("AUTH_PASSWORD_CHANGE_RATE_LIMITED"));
		assertThat(userRepository.findById(profileUserId).orElseThrow().getPassword()).isEqualTo(originalHash);
	}

	@Test
	void rejectsNewPasswordEqualToCurrent() throws Exception {
		String accessToken = loginAndGetAccessToken();
		String originalHash = userRepository.findById(profileUserId).orElseThrow().getPassword();

		changePassword(accessToken, "SecurePass123!", "SecurePass123!", "SecurePass123!")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("AUTH_NEW_PASSWORD_MUST_DIFFER"));
		assertThat(userRepository.findById(profileUserId).orElseThrow().getPassword()).isEqualTo(originalHash);
	}

	@Test
	void mapsPasswordConfirmationMismatchToFieldError() throws Exception {
		String accessToken = loginAndGetAccessToken();

		changePassword(accessToken, "SecurePass123!", "BrandNew456!", "Different789!")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors.confirmPassword").exists());
	}

	private ResultActions patchProfile(String accessToken, String json) throws Exception {
		return mockMvc.perform(patch("/api/v1/users/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(json));
	}

	private ResultActions changePassword(String accessToken, String current, String next, String confirm) throws Exception {
		return mockMvc.perform(patch("/api/v1/users/me/password")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(passwordBody(current, next, confirm)));
	}

	private String passwordBody(String current, String next, String confirm) {
		return objectMapper.writeValueAsString(Map.of(
				"currentPassword", current, "newPassword", next, "confirmPassword", confirm));
	}

	private ResultActions loginRequest(String password) throws Exception {
		return mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", "profile.user@example.com",
						"password", password
				))));
	}

	private Session login(String password) throws Exception {
		MvcResult result = loginRequest(password).andExpect(status().isOk()).andReturn();
		String accessToken = objectMapper.readTree(result.getResponse().getContentAsString())
				.at("/data/accessToken")
				.asText();
		assertThat(accessToken).isNotBlank();
		return new Session(accessToken, result.getResponse().getCookie("refresh_token").getValue());
	}

	private String loginAndGetAccessToken() throws Exception {
		return login("SecurePass123!").accessToken();
	}

	private record Session(String accessToken, String refreshToken) {
	}
}
