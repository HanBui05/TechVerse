package com.techverse.server.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.entity.User;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
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

	private String loginAndGetAccessToken() throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", "profile.user@example.com",
						"password", "SecurePass123!"
				))))
				.andExpect(status().isOk())
				.andReturn();

		String accessToken = objectMapper.readTree(result.getResponse().getContentAsString())
				.at("/data/accessToken")
				.asText();
		assertThat(accessToken).isNotBlank();
		return accessToken;
	}
}
