package com.techverse.server.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;
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
class AdminUserIntegrationTest {

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
	private JdbcTemplate jdbcTemplate;

	private UUID adminId;
	private UUID learnerId;
	private UUID pendingAuthorId;

	@BeforeEach
	void setUpUsers() {
		tokenRepository.deleteAll();
		userRepository.deleteAll();

		adminId = saveLocalUser("System Admin", "admin@example.com", true);
		assignRole(adminId, RoleName.ADMIN);
		learnerId = saveLocalUser("Plain Learner", "learner@example.com", true);
		pendingAuthorId = saveLocalUser("Pending Author", "pending.author@example.com", true);
		createAuthorProfile(pendingAuthorId, "PENDING");

		UUID inactivePendingAuthorId = saveLocalUser("Inactive Pending Author", "inactive.pending@example.com", false);
		createAuthorProfile(inactivePendingAuthorId, "PENDING");
	}

	@Test
	void adminListsTheIntersectionOfAllSupportedFiltersWithPagination() throws Exception {
		String adminAccessToken = loginAndGetAccessToken("admin@example.com");

		mockMvc.perform(get("/api/v1/admin/users")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAccessToken)
				.param("keyword", "pending")
				.param("active", "true")
				.param("role", "LEARNER")
				.param("authorStatus", "PENDING")
				.param("page", "0")
				.param("size", "20")
				.param("sortBy", "CREATED_AT")
				.param("direction", "DESC"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(jsonPath("$.data.content.length()").value(1))
				.andExpect(jsonPath("$.data.content[0].id").value(pendingAuthorId.toString()))
				.andExpect(jsonPath("$.data.content[0].fullName").value("Pending Author"))
				.andExpect(jsonPath("$.data.content[0].roles[0]").value("LEARNER"))
				.andExpect(jsonPath("$.data.content[0].active").value(true))
				.andExpect(jsonPath("$.data.content[0].authorProfileStatus").value("PENDING"))
				.andExpect(jsonPath("$.data.page").value(0))
				.andExpect(jsonPath("$.data.size").value(20))
				.andExpect(jsonPath("$.data.totalElements").value(1))
				.andExpect(jsonPath("$.data.totalPages").value(1))
				.andExpect(jsonPath("$.data.hasNext").value(false));
	}

	@Test
	void adminSeesNullAuthorStatusForAUserWithoutAnApplication() throws Exception {
		String adminAccessToken = loginAndGetAccessToken("admin@example.com");

		mockMvc.perform(get("/api/v1/admin/users")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAccessToken)
				.param("keyword", "plain learner"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.content.length()").value(1))
				.andExpect(jsonPath("$.data.content[0].id").value(learnerId.toString()))
				.andExpect(jsonPath("$.data.content[0].authorProfileStatus").value(nullValue()));
	}

	@Test
	void adminGetsUserDetailsWithoutExposingCredentials() throws Exception {
		String adminAccessToken = loginAndGetAccessToken("admin@example.com");

		mockMvc.perform(get("/api/v1/admin/users/{userId}", pendingAuthorId)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAccessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.id").value(pendingAuthorId.toString()))
				.andExpect(jsonPath("$.data.email").value("pending.author@example.com"))
				.andExpect(jsonPath("$.data.roles[0]").value("LEARNER"))
				.andExpect(jsonPath("$.data.hasLocalPassword").value(true))
				.andExpect(jsonPath("$.data.socialProviders").isEmpty())
				.andExpect(jsonPath("$.data.authorProfile.status").value("PENDING"))
				.andExpect(jsonPath("$.data.password").doesNotExist())
				.andExpect(jsonPath("$.data.authorProfile.userId").doesNotExist());
	}

	@Test
	void returnsNotFoundWhenAdminRequestsAnUnknownUser() throws Exception {
		String adminAccessToken = loginAndGetAccessToken("admin@example.com");

		mockMvc.perform(get("/api/v1/admin/users/{userId}", UUID.randomUUID())
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAccessToken))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
	}

	@Test
	void rejectsListRequestsFromAUserWithoutTheAdminRole() throws Exception {
		String learnerAccessToken = loginAndGetAccessToken("learner@example.com");

		mockMvc.perform(get("/api/v1/admin/users")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + learnerAccessToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
	}

	@Test
	void rejectsDetailRequestsFromAUserWithoutTheAdminRole() throws Exception {
		String learnerAccessToken = loginAndGetAccessToken("learner@example.com");

		mockMvc.perform(get("/api/v1/admin/users/{userId}", pendingAuthorId)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + learnerAccessToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
	}

	@Test
	void rejectsAnOversizedAdminUserPage() throws Exception {
		String adminAccessToken = loginAndGetAccessToken("admin@example.com");

		mockMvc.perform(get("/api/v1/admin/users")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + adminAccessToken)
				.param("size", "101"))
				.andExpect(status().isBadRequest());
	}

	private UUID saveLocalUser(String fullName, String email, boolean active) {
		User user = User.createLocalAccount(
				fullName,
				email,
				passwordEncoder.encode("SecurePass123!"),
				"0912345678",
				LocalDate.of(2000, 5, 24)
		);
		UUID userId = userRepository.saveAndFlush(user).getId();
		if (!active) {
			jdbcTemplate.update("UPDATE techverse.users SET is_active = false WHERE id = ?", userId);
		}
		return userId;
	}

	private void assignRole(UUID userId, RoleName roleName) {
		jdbcTemplate.update(
				"""
						INSERT INTO techverse.user_roles (user_id, role_id)
						SELECT ?, id FROM techverse.roles WHERE name = ?
						ON CONFLICT (user_id, role_id) DO NOTHING
						""",
				userId,
				roleName.name()
		);
	}

	private void createAuthorProfile(UUID userId, String status) {
		jdbcTemplate.update(
				"""
						INSERT INTO techverse.author_profiles (user_id, bio, expertise, status)
						VALUES (?, 'I build backend services with Java and Spring Boot.', 'Java, Spring Boot', ?)
						""",
				userId,
				status
		);
	}

	private String loginAndGetAccessToken(String email) throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", email,
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
