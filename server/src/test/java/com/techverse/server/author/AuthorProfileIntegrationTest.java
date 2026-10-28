package com.techverse.server.author;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.entity.User;
import com.techverse.server.repository.AuthorProfileRepository;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthorProfileService;
import java.time.LocalDate;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
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
import org.springframework.transaction.support.TransactionTemplate;
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
class AuthorProfileIntegrationTest {

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

	@Autowired
	private AuthorProfileService authorProfileService;

	@Autowired
	private AuthorProfileRepository authorProfileRepository;

	@Autowired
	private TransactionTemplate transactionTemplate;

	private UUID applicantId;

	@BeforeEach
	void setUpUser() {
		tokenRepository.deleteAll();
		userRepository.deleteAll();
		User user = User.createLocalAccount(
				"Author Applicant",
				"author.applicant@example.com",
				passwordEncoder.encode("SecurePass123!"),
				"0912345678",
				LocalDate.of(2000, 5, 24)
		);
		applicantId = userRepository.saveAndFlush(user).getId();
	}

	@Test
	void submitsOnePendingAuthorProfileForTheAuthenticatedUser() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of(
						"bio", "I build production backend services with Java, Spring Boot, PostgreSQL, and Docker.",
						"expertise", "Java, Spring Boot, PostgreSQL, Docker",
						"portfolioUrl", "https://github.com/author-applicant"
				))))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value(201))
				.andExpect(jsonPath("$.message").value("Author profile application submitted successfully"))
				.andExpect(jsonPath("$.data.bio")
						.value("I build production backend services with Java, Spring Boot, PostgreSQL, and Docker."))
				.andExpect(jsonPath("$.data.expertise").value("Java, Spring Boot, PostgreSQL, Docker"))
				.andExpect(jsonPath("$.data.portfolioUrl").value("https://github.com/author-applicant"))
				.andExpect(jsonPath("$.data.status").value("PENDING"))
				.andExpect(jsonPath("$.data.createdAt").isNotEmpty())
				.andExpect(jsonPath("$.data.updatedAt").isNotEmpty());

		Map<String, Object> persistedProfile = jdbcTemplate.queryForMap(
				"SELECT user_id, created_by, updated_by FROM techverse.author_profiles WHERE user_id = ?",
				applicantId
		);
		assertThat(persistedProfile.get("user_id")).isEqualTo(applicantId);
		assertThat(persistedProfile.get("created_by")).isEqualTo(applicantId);
		assertThat(persistedProfile.get("updated_by")).isEqualTo(applicantId);
	}

	@Test
	void rejectsASecondAuthorProfileApplicationForTheSameUser() throws Exception {
		String accessToken = loginAndGetAccessToken();
		String requestBody = validApplicationRequest();

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(requestBody))
				.andExpect(status().isCreated());

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(requestBody))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("AUTHOR_PROFILE_ALREADY_EXISTS"));

		Integer profileCount = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM techverse.author_profiles WHERE user_id = ?",
				Integer.class,
				applicantId
		);
		assertThat(profileCount).isEqualTo(1);
	}

	@Test
	void rejectsAnApplicationWithBlankBio() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of(
						"bio", "   ",
						"expertise", "Java, Spring Boot",
						"portfolioUrl", "https://github.com/author-applicant"
				))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors.bio").isNotEmpty());
	}

	@Test
	void rejectsAnApplicationWithANonHttpPortfolioUrl() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of(
						"bio", "I build production backend services with Java, Spring Boot, PostgreSQL, and Docker.",
						"expertise", "Java, Spring Boot",
						"portfolioUrl", "ftp://example.com/portfolio"
				))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
				.andExpect(jsonPath("$.fieldErrors.portfolioUrl")
						.value("Portfolio URL must use HTTP or HTTPS"));
	}

	@Test
	void rejectsAnApplicationWithAMalformedHttpPortfolioUrl() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of(
						"bio", "I build production backend services with Java, Spring Boot, PostgreSQL, and Docker.",
						"expertise", "Java, Spring Boot",
						"portfolioUrl", "https://?"
				))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.portfolioUrl")
						.value("Portfolio URL must use HTTP or HTTPS"));
	}

	@Test
	void acceptsAnApplicationWithAWhitespaceOnlyOptionalPortfolioUrl() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of(
						"bio", "I build production backend services with Java, Spring Boot, PostgreSQL, and Docker.",
						"expertise", "Java, Spring Boot",
						"portfolioUrl", "   "
				))))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.data.portfolioUrl").value(nullValue()));
	}

	@Test
	void rejectsContentThatBecomesTooShortAfterTrimming() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(objectMapper.writeValueAsString(Map.of(
						"bio", "a" + " ".repeat(49),
						"expertise", "a  ",
						"portfolioUrl", "https://github.com/author-applicant"
				))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.bio")
						.value("Bio must contain between 50 and 2000 characters"))
				.andExpect(jsonPath("$.fieldErrors.expertise")
						.value("Expertise must contain between 3 and 255 characters"));
	}

	@Test
	void rejectsAnApplicationWithoutAnAccessToken() throws Exception {
		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.content(validApplicationRequest()))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
	}

	@Test
	void rejectsAnApplicationForAnInactiveUser() throws Exception {
		String accessToken = loginAndGetAccessToken();
		jdbcTemplate.update("UPDATE techverse.users SET is_active = false WHERE id = ?", applicantId);

		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(validApplicationRequest()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("USER_INACTIVE"));
	}

	@Test
	void returnsNotAppliedWhenTheAuthenticatedUserHasNoAuthorProfile() throws Exception {
		String accessToken = loginAndGetAccessToken();

		mockMvc.perform(get("/api/v1/author-profiles/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value(200))
				.andExpect(jsonPath("$.message").value("Author profile retrieved successfully"))
				.andExpect(jsonPath("$.data.applicationStatus").value("NOT_APPLIED"))
				.andExpect(jsonPath("$.data.profile").value(nullValue()));
	}

	@Test
	void returnsReviewDetailsForARejectedAuthorProfile() throws Exception {
		String accessToken = loginAndGetAccessToken();
		mockMvc.perform(post("/api/v1/author-profiles/me")
				.contentType(MediaType.APPLICATION_JSON)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.content(validApplicationRequest()))
				.andExpect(status().isCreated());

		Instant reviewedAt = Instant.parse("2026-10-26T03:30:00Z");
		jdbcTemplate.update(
				"UPDATE techverse.author_profiles SET status = 'REJECTED', review_note = ?, reviewed_at = ? WHERE user_id = ?",
				"Please add a portfolio with completed projects.",
				Timestamp.from(reviewedAt),
				applicantId
		);

		mockMvc.perform(get("/api/v1/author-profiles/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.applicationStatus").value("REJECTED"))
				.andExpect(jsonPath("$.data.profile.status").value("REJECTED"))
				.andExpect(jsonPath("$.data.profile.reviewNote")
						.value("Please add a portfolio with completed projects."))
				.andExpect(jsonPath("$.data.profile.reviewedAt").value("2026-10-26T03:30:00Z"));
	}

	@Test
	void rejectsAuthorProfileLookupWithoutAnAccessToken() throws Exception {
		mockMvc.perform(get("/api/v1/author-profiles/me"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
	}

	@Test
	void rejectsAuthorProfileLookupForAnInactiveUser() throws Exception {
		String accessToken = loginAndGetAccessToken();
		jdbcTemplate.update("UPDATE techverse.users SET is_active = false WHERE id = ?", applicantId);

		mockMvc.perform(get("/api/v1/author-profiles/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("USER_INACTIVE"));
	}

	@Test
	void waitsForTheApplicantLockBeforeCheckingForAnExistingApplication() throws Exception {
		CountDownLatch lockAcquired = new CountDownLatch(1);
		CountDownLatch releaseLock = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(2);

		try {
			Future<?> lockHolder = executor.submit(() -> transactionTemplate.executeWithoutResult(status -> {
				userRepository.findByIdForAuthorProfileApplication(applicantId).orElseThrow();
				lockAcquired.countDown();
				await(releaseLock);
			}));
			assertThat(lockAcquired.await(5, TimeUnit.SECONDS)).isTrue();

			Future<?> application = executor.submit(() -> authorProfileService.apply(
					applicantId,
					new com.techverse.server.dto.request.ApplyAuthorProfileRequest(
							"I build production backend services with Java, Spring Boot, PostgreSQL, and Docker.",
							"Java, Spring Boot, PostgreSQL, Docker",
							"https://github.com/author-applicant"
					)
			));

			assertThat(application.isDone()).isFalse();
			releaseLock.countDown();
			lockHolder.get(5, TimeUnit.SECONDS);
			application.get(5, TimeUnit.SECONDS);
			assertThat(authorProfileRepository.existsByUser_Id(applicantId)).isTrue();
		} finally {
			releaseLock.countDown();
			executor.shutdownNow();
		}
	}

	private void await(CountDownLatch latch) {
		try {
			latch.await();
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException(exception);
		}
	}

	private String validApplicationRequest() throws Exception {
		return objectMapper.writeValueAsString(Map.of(
				"bio", "I build production backend services with Java, Spring Boot, PostgreSQL, and Docker.",
				"expertise", "Java, Spring Boot, PostgreSQL, Docker",
				"portfolioUrl", "https://github.com/author-applicant"
		));
	}

	private String loginAndGetAccessToken() throws Exception {
		MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", "author.applicant@example.com",
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
