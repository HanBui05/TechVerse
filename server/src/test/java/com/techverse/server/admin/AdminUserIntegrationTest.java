package com.techverse.server.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.SocialProvider;
import com.techverse.server.enums.TokenType;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.SocialAccountRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthService;
import com.techverse.server.service.TokenService;
import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.dto.internal.SocialProfile;
import com.techverse.server.entity.SocialAccount;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.Instant;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
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
	private RoleRepository roleRepository;

	@Autowired
	private SocialAccountRepository socialAccountRepository;

	@Autowired
	private TokenRepository tokenRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private AuthService authService;

	@Autowired
	private JwtEncoder jwtEncoder;

	@MockitoSpyBean
	private TokenService tokenService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private TransactionTemplate transactionTemplate;

	private UUID adminId;
	private UUID secondAdminId;
	private UUID learnerId;
	private UUID pendingAuthorId;

	@BeforeEach
	void setUpUsers() {
		tokenRepository.deleteAll();
		userRepository.deleteAll();

		adminId = saveLocalUser("System Admin", "admin@example.com", true);
		assignRole(adminId, RoleName.ADMIN);
		secondAdminId = saveLocalUser("Second Admin", "second.admin@example.com", true);
		assignRole(secondAdminId, RoleName.ADMIN);
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

	@Test
	void adminLocksMultipleUsersAndRevokesTheirAccessAndRefreshTokens() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		TestSession learner = loginAndGetSession("learner@example.com");
		TestSession otherLearnerDevice = loginAndGetSession("learner@example.com");
		TestSession pendingAuthor = loginAndGetSession("pending.author@example.com");

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId, pendingAuthorId), false))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.active").value(false))
				.andExpect(jsonPath("$.data.requestedCount").value(2))
				.andExpect(jsonPath("$.data.changedCount").value(2))
				.andExpect(jsonPath("$.data.unchangedCount").value(0))
				.andExpect(jsonPath("$.data.users.length()").value(2))
				.andExpect(jsonPath("$.data.users[0].active").value(false))
				.andExpect(jsonPath("$.data.users[1].active").value(false));
		assertThat(isUserActive(learnerId)).isFalse();
		assertThat(isUserActive(pendingAuthorId)).isFalse();

		for (TestSession lockedUser : List.of(learner, otherLearnerDevice, pendingAuthor)) {
			mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + lockedUser.accessToken()))
					.andExpect(status().isUnauthorized());
			mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(new Cookie("refresh_token", lockedUser.refreshToken())))
					.andExpect(status().isUnauthorized());
			mockMvc.perform(patch("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + lockedUser.accessToken())
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"fullName\":\"Must not update\"}"))
					.andExpect(status().isUnauthorized());
			mockMvc.perform(get("/api/v1/author-profiles/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + lockedUser.accessToken()))
					.andExpect(status().isUnauthorized());
		}
		mockMvc.perform(loginRequest("learner@example.com"))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/admin/users")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + admin.accessToken()))
				.andExpect(status().isOk());
	}

	@Test
	void unlockingUserDoesNotRestoreOldTokensAndAllowsANewLogin() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		TestSession oldLearnerSession = loginAndGetSession("learner@example.com");

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId), false))
				.andExpect(status().isOk());
		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId), true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.changedCount").value(1));

		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + oldLearnerSession.accessToken()))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(post("/api/v1/auth/refresh")
				.cookie(new Cookie("refresh_token", oldLearnerSession.refreshToken())))
				.andExpect(status().isUnauthorized());

		TestSession newLearnerSession = loginAndGetSession("learner@example.com");
		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + newLearnerSession.accessToken()))
				.andExpect(status().isOk());
	}

	@Test
	void settingAnAlreadyActiveUserActiveIsAnIdempotentNoOp() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		TestSession learner = loginAndGetSession("learner@example.com");

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId), true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.requestedCount").value(1))
				.andExpect(jsonPath("$.data.changedCount").value(0))
				.andExpect(jsonPath("$.data.unchangedCount").value(1));
		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + learner.accessToken()))
				.andExpect(status().isOk());
	}

	@Test
	void adminCannotLockTheirOwnAccount() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		TestSession learner = loginAndGetSession("learner@example.com");

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(adminId, learnerId), false))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ADMIN_SELF_LOCK_NOT_ALLOWED"));

		assertThat(isUserActive(adminId)).isTrue();
		assertThat(isUserActive(learnerId)).isTrue();
		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + learner.accessToken()))
				.andExpect(status().isOk());
	}

	@Test
	void invalidBulkSelectionsFailWithoutPartiallyChangingUsers() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId, learnerId), false))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_USER_SELECTION"));
		mockMvc.perform(patch("/api/v1/admin/users/bulk-status")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + admin.accessToken())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("userIds", List.of(), "active", false))))
				.andExpect(status().isBadRequest());

		List<UUID> oversizedSelection = new ArrayList<>();
		for (int index = 0; index < 101; index++) {
			oversizedSelection.add(UUID.randomUUID());
		}
		mockMvc.perform(bulkStatusRequest(admin.accessToken(), oversizedSelection, false))
				.andExpect(status().isBadRequest());
		mockMvc.perform(patch("/api/v1/admin/users/bulk-status")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + admin.accessToken())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"userIds\":[\"not-a-uuid\"],\"active\":false}"))
				.andExpect(status().isBadRequest());
		mockMvc.perform(patch("/api/v1/admin/users/bulk-status")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + admin.accessToken())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("userIds", List.of(learnerId)))))
				.andExpect(status().isBadRequest());

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId, UUID.randomUUID()), false))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
		assertThat(isUserActive(learnerId)).isTrue();
	}

	@Test
	void nonAdminCannotChangeUserStatuses() throws Exception {
		TestSession learner = loginAndGetSession("learner@example.com");

		mockMvc.perform(bulkStatusRequest(learner.accessToken(), List.of(pendingAuthorId), false))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
		assertThat(isUserActive(pendingAuthorId)).isTrue();
		mockMvc.perform(bulkStatusRequest(learner.accessToken(), List.of(pendingAuthorId), true))
				.andExpect(status().isForbidden());
		mockMvc.perform(bulkStatusRequest(learner.refreshToken(), List.of(pendingAuthorId), false))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(bulkStatusRequest("malformed-token", List.of(pendingAuthorId), false))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(patch("/api/v1/admin/users/bulk-status")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("userIds", List.of(pendingAuthorId), "active", false))))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void lockingAnAlreadyLockedUserIsANoOpWithoutChangingAuditFields() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId), false))
				.andExpect(status().isOk());
		User lockedBefore = userRepository.findById(learnerId).orElseThrow();

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId), false))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.changedCount").value(0))
				.andExpect(jsonPath("$.data.unchangedCount").value(1));

		User lockedAfter = userRepository.findById(learnerId).orElseThrow();
		assertThat(lockedAfter.isActive()).isFalse();
		assertThat(lockedAfter.getUpdatedAt()).isEqualTo(lockedBefore.getUpdatedAt());
		assertThat(lockedAfter.getUpdatedBy()).isEqualTo(lockedBefore.getUpdatedBy());
	}

	@Test
	void mixedBulkUnlockChangesOnlyLockedUsersAndPreservesRequestOrder() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId), false))
				.andExpect(status().isOk());
		User unchangedAuthor = userRepository.findById(pendingAuthorId).orElseThrow();

		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(pendingAuthorId, learnerId), true))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.requestedCount").value(2))
				.andExpect(jsonPath("$.data.changedCount").value(1))
				.andExpect(jsonPath("$.data.unchangedCount").value(1))
				.andExpect(jsonPath("$.data.users[0].userId").value(pendingAuthorId.toString()))
				.andExpect(jsonPath("$.data.users[1].userId").value(learnerId.toString()));

		assertThat(isUserActive(learnerId)).isTrue();
		assertThat(isUserActive(pendingAuthorId)).isTrue();
		assertThat(userRepository.findById(pendingAuthorId).orElseThrow().getUpdatedAt())
				.isEqualTo(unchangedAuthor.getUpdatedAt());
	}

	@Test
	void nullBulkInputsAreRejectedWithoutMutatingTheSelection() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		List<String> bodies = List.of(
				"null",
				"{}",
				"{\"userIds\":null,\"active\":false}",
				"{\"userIds\":[\"" + learnerId + "\"],\"active\":null}",
				"{\"userIds\":[\"" + learnerId + "\",null],\"active\":false}"
		);
		for (String body : bodies) {
			mockMvc.perform(patch("/api/v1/admin/users/bulk-status")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + admin.accessToken())
					.contentType(MediaType.APPLICATION_JSON)
					.content(body))
					.andExpect(status().isBadRequest());
		}
		assertThat(isUserActive(learnerId)).isTrue();
	}

	@Test
	void lockingUpdatesAdminViewsAndAuditWithoutChangingAuthorApplicationOrRoles() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		User before = userRepository.findById(pendingAuthorId).orElseThrow();
		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(pendingAuthorId), false))
				.andExpect(status().isOk());

		User after = userRepository.findById(pendingAuthorId).orElseThrow();
		assertThat(after.getUpdatedBy()).isEqualTo(adminId);
		assertThat(after.getCreatedAt()).isEqualTo(before.getCreatedAt());
		assertThat(after.getCreatedBy()).isEqualTo(before.getCreatedBy());
		mockMvc.perform(get("/api/v1/admin/users/{userId}", pendingAuthorId)
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + admin.accessToken()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.active").value(false))
				.andExpect(jsonPath("$.data.roles[0]").value("LEARNER"))
				.andExpect(jsonPath("$.data.authorProfile.status").value("PENDING"));
		mockMvc.perform(get("/api/v1/admin/users")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + admin.accessToken())
				.param("keyword", "pending.author@example.com")
				.param("active", "false")
				.param("authorStatus", "PENDING"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.totalElements").value(1))
				.andExpect(jsonPath("$.data.content[0].id").value(pendingAuthorId.toString()));
	}

	@Test
	void lockedSocialOnlyUserCannotSignInUntilUnlockedAndOldRefreshStaysRevoked() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		User user = userRepository.saveAndFlush(User.createSocialAccount("Social Only User", "social.only@example.com"));
		socialAccountRepository.saveAndFlush(SocialAccount.link(user, SocialProvider.GOOGLE, "social-only-subject"));
		SocialProfile profile = SocialProfile.builder()
				.provider(SocialProvider.GOOGLE).providerId("social-only-subject")
				.email("social.only@example.com").fullName("Social Only User").emailVerified(true).build();
		JwtDetails oldRefresh = authService.authenticateSocialAccount(profile);
		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(user.getId()), false))
				.andExpect(status().isOk());

		assertThatThrownBy(() -> authService.authenticateSocialAccount(profile))
				.isInstanceOfSatisfying(CustomException.class,
						exception -> assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.SOCIAL_ACCOUNT_INACTIVE));
		mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(user.getId()), true))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", oldRefresh.getValue())))
				.andExpect(status().isUnauthorized());
		JwtDetails newRefresh = authService.authenticateSocialAccount(profile);
		mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", newRefresh.getValue())))
				.andExpect(status().isOk());
		assertThat(userRepository.findById(user.getId()).orElseThrow().getPassword()).isNull();
	}

	@Test
	void concurrentRefreshRequestsCanReuseTheSameRefreshTokenWithinAnActiveSession() throws Exception {
		TestSession learner = loginAndGetSession("learner@example.com");
		CountDownLatch userRowHeld = new CountDownLatch(1);
		CountDownLatch releaseUserRow = new CountDownLatch(1);
		try (ExecutorService executor = Executors.newFixedThreadPool(3)) {
			var holder = executor.submit(() -> transactionTemplate.executeWithoutResult(transaction -> {
				userRepository.findAllByIdForAdminStatusUpdate(List.of(learnerId));
				userRowHeld.countDown();
				awaitLatch(releaseUserRow);
			}));
			assertThat(userRowHeld.await(10, TimeUnit.SECONDS)).isTrue();
			var first = executor.submit(() -> mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(new Cookie("refresh_token", learner.refreshToken()))).andReturn());
			var second = executor.submit(() -> mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(new Cookie("refresh_token", learner.refreshToken()))).andReturn());
			assertThat(awaitCondition(() -> countWaitingDatabaseLocks("users")
					+ (first.isDone() ? 1 : 0) + (second.isDone() ? 1 : 0) >= 2)).isTrue();
			releaseUserRow.countDown();
			List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS).getResponse().getStatus(),
					second.get(30, TimeUnit.SECONDS).getResponse().getStatus());
			holder.get(30, TimeUnit.SECONDS);
			assertThat(statuses).containsExactly(200, 200);
			assertThat(first.get().getResponse().getCookie("refresh_token").getValue())
					.isEqualTo(learner.refreshToken());
			assertThat(second.get().getResponse().getCookie("refresh_token").getValue())
					.isEqualTo(learner.refreshToken());
		} finally {
			releaseUserRow.countDown();
		}
	}

	@ParameterizedTest
	@ValueSource(strings = {"logout", "logout-all"})
	void inFlightRefreshCannotRestoreASessionAfterLogoutCompletes(String logoutEndpoint) throws Exception {
		TestSession learner = loginAndGetSession("learner@example.com");
		CountDownLatch tokenGenerated = new CountDownLatch(1);
		CountDownLatch continueRefresh = new CountDownLatch(1);
		pauseAccessTokenGeneration(learnerId, tokenGenerated, continueRefresh);
		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			var refresh = executor.submit(() -> mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(new Cookie("refresh_token", learner.refreshToken()))).andReturn());
			assertThat(tokenGenerated.await(10, TimeUnit.SECONDS)).isTrue();
			var logout = executor.submit(() -> mockMvc.perform(post("/api/v1/auth/" + logoutEndpoint)
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + learner.accessToken())
					.cookie(new Cookie("refresh_token", learner.refreshToken()))).andReturn());
			assertThat(awaitLockOperationProgress(logout, "users")).isTrue();
			continueRefresh.countDown();
			MvcResult refreshResult = refresh.get(30, TimeUnit.SECONDS);
			assertThat(logout.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
			assertThat(refreshResult.getResponse().getStatus()).isEqualTo(200);
			String accessToken = objectMapper.readTree(refreshResult.getResponse().getContentAsString())
					.at("/data/accessToken").asText();
			mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
					.andExpect(status().isUnauthorized());
		} finally {
			continueRefresh.countDown();
		}
	}

	@Test
	void logoutAfterRefreshAlsoRevokesThePreviousAccessTokenFromTheSameDevice() throws Exception {
		TestSession original = loginAndGetSession("learner@example.com");
		TestSession otherDevice = loginAndGetSession("learner@example.com");
		MvcResult refreshed = mockMvc.perform(post("/api/v1/auth/refresh")
				.cookie(new Cookie("refresh_token", original.refreshToken())))
				.andExpect(status().isOk()).andReturn();
		String currentAccess = objectMapper.readTree(refreshed.getResponse().getContentAsString())
				.at("/data/accessToken").asText();
		Cookie currentRefresh = refreshed.getResponse().getCookie("refresh_token");

		mockMvc.perform(post("/api/v1/auth/logout")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + currentAccess)
				.cookie(currentRefresh))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + currentAccess))
				.andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + otherDevice.accessToken()))
				.andExpect(status().isOk());
		mockMvc.perform(get("/api/v1/users/me")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + original.accessToken()))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void rejectsRefreshThatExpiresWhilePreparingItsNewAccessToken() throws Exception {
		String sid = UUID.randomUUID().toString();
		String refreshJti = UUID.randomUUID().toString();
		Instant expiresAt = Instant.now().plusSeconds(4).truncatedTo(ChronoUnit.SECONDS);
		JwtClaimsSet claims = JwtClaimsSet.builder().issuer("https://api.techverse.local")
				.subject(learnerId.toString()).id(refreshJti).issuedAt(Instant.now())
				.expiresAt(expiresAt).claim("token_type", "refresh").claim("sid", sid).build();
		String raw = jwtEncoder.encode(JwtEncoderParameters.from(
				JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
		JwtDetails refresh = JwtDetails.builder().value(raw).jwtId(refreshJti).sessionId(sid)
				.expiresAt(expiresAt).secondsTtl(Duration.between(Instant.now(), expiresAt).toSeconds()).build();
		tokenService.createSession(learnerId, refresh);
		tokenService.saveToken(refresh, learnerId, TokenType.REFRESH);
		doAnswer(invocation -> {
			assertThat(awaitCondition(() -> !Instant.now().isBefore(expiresAt))).isTrue();
			return invocation.callRealMethod();
		}).when(tokenService).generateAccessToken(eq(learnerId), anySet(), eq(sid));

		mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("refresh_token", raw)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_INVALID_REFRESH_TOKEN"));
	}

	@Test
	void loginAlreadyInProgressCannotLeaveANewSessionAfterLogoutAllCompletes() throws Exception {
		TestSession existing = loginAndGetSession("learner@example.com");
		CountDownLatch tokenGenerated = new CountDownLatch(1);
		CountDownLatch continueLogin = new CountDownLatch(1);
		pauseAccessTokenGeneration(learnerId, tokenGenerated, continueLogin);
		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			var login = executor.submit(() -> mockMvc.perform(loginRequest("learner@example.com")).andReturn());
			assertThat(tokenGenerated.await(10, TimeUnit.SECONDS)).isTrue();
			var logout = executor.submit(() -> mockMvc.perform(post("/api/v1/auth/logout-all")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + existing.accessToken())).andReturn());
			assertThat(awaitLockOperationProgress(logout, "users")).isTrue();
			continueLogin.countDown();
			MvcResult loginResult = login.get(30, TimeUnit.SECONDS);
			assertThat(loginResult.getResponse().getStatus()).isEqualTo(200);
			assertThat(logout.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
			String access = objectMapper.readTree(loginResult.getResponse().getContentAsString())
					.at("/data/accessToken").asText();
			mockMvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + access))
					.andExpect(status().isUnauthorized());
			mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(loginResult.getResponse().getCookie("refresh_token")))
					.andExpect(status().isUnauthorized());
		} finally {
			continueLogin.countDown();
		}
		// A genuinely new login after logout-all is allowed for an active account.
		mockMvc.perform(loginRequest("learner@example.com")).andExpect(status().isOk());
	}

	@Test
	void loginStartedBeforeAccountLockCannotCreateASessionAfterTheLockCommits() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		CountDownLatch tokenGenerated = new CountDownLatch(1);
		CountDownLatch continueLogin = new CountDownLatch(1);
		pauseAccessTokenGeneration(learnerId, tokenGenerated, continueLogin);

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			var login = executor.submit(() -> mockMvc.perform(loginRequest("learner@example.com")).andReturn());
			assertThat(tokenGenerated.await(10, TimeUnit.SECONDS)).isTrue();
			var lock = executor.submit(() -> mockMvc.perform(
					bulkStatusRequest(admin.accessToken(), List.of(learnerId), false)).andReturn());
			assertThat(awaitLockOperationProgress(lock, "users")).isTrue();
			continueLogin.countDown();

			MvcResult loginResult = login.get(30, TimeUnit.SECONDS);
			assertThat(lock.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
			assertThat(loginResult.getResponse().getStatus()).isEqualTo(200);
			String accessToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
					.at("/data/accessToken").asText();
			String refreshToken = loginResult.getResponse().getCookie("refresh_token").getValue();

			mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
					.andExpect(status().isUnauthorized());
			mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(new Cookie("refresh_token", refreshToken)))
					.andExpect(status().isUnauthorized());
		} finally {
			continueLogin.countDown();
		}
	}

	@Test
	void refreshStartedBeforeAccountLockCannotCreateASessionAfterTheLockCommits() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		TestSession learner = loginAndGetSession("learner@example.com");
		CountDownLatch tokenGenerated = new CountDownLatch(1);
		CountDownLatch continueRefresh = new CountDownLatch(1);
		pauseAccessTokenGeneration(learnerId, tokenGenerated, continueRefresh);

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			var refresh = executor.submit(() -> mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(new Cookie("refresh_token", learner.refreshToken()))).andReturn());
			assertThat(tokenGenerated.await(10, TimeUnit.SECONDS)).isTrue();
			var lock = executor.submit(() -> mockMvc.perform(
					bulkStatusRequest(admin.accessToken(), List.of(learnerId), false)).andReturn());
			assertThat(awaitLockOperationProgress(lock, "users")).isTrue();
			continueRefresh.countDown();

			MvcResult refreshResult = refresh.get(30, TimeUnit.SECONDS);
			assertThat(lock.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
			assertThat(refreshResult.getResponse().getStatus()).isEqualTo(200);
			String accessToken = objectMapper.readTree(refreshResult.getResponse().getContentAsString())
					.at("/data/accessToken").asText();
			String refreshToken = refreshResult.getResponse().getCookie("refresh_token").getValue();

			mockMvc.perform(get("/api/v1/users/me")
					.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
					.andExpect(status().isUnauthorized());
			mockMvc.perform(post("/api/v1/auth/refresh")
					.cookie(new Cookie("refresh_token", refreshToken)))
					.andExpect(status().isUnauthorized());
		} finally {
			continueRefresh.countDown();
		}
	}

	@Test
	void socialLoginStartedBeforeAccountLockCannotCreateARefreshSessionAfterTheLockCommits() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		UUID socialUserId = saveLocalUser("Google User", "google.user@example.com", true);
		socialAccountRepository.saveAndFlush(SocialAccount.link(
				userRepository.findById(socialUserId).orElseThrow(), SocialProvider.GOOGLE, "google-user-subject"));
		CountDownLatch tokenGenerated = new CountDownLatch(1);
		CountDownLatch continueSocialLogin = new CountDownLatch(1);
		pauseRefreshTokenGeneration(socialUserId, tokenGenerated, continueSocialLogin);

		try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
			var socialLogin = executor.submit(() -> authService.authenticateSocialAccount(SocialProfile.builder()
					.provider(SocialProvider.GOOGLE)
					.providerId("google-user-subject")
					.email("google.user@example.com")
					.fullName("Google User")
					.emailVerified(true)
					.build()));
			assertThat(tokenGenerated.await(10, TimeUnit.SECONDS)).isTrue();
			var lock = executor.submit(() -> mockMvc.perform(
					bulkStatusRequest(admin.accessToken(), List.of(socialUserId), false)).andReturn());
			assertThat(awaitLockOperationProgress(lock, "users")).isTrue();
			continueSocialLogin.countDown();

			JwtDetails refreshToken = socialLogin.get(30, TimeUnit.SECONDS);
			assertThat(lock.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
			assertThat(tokenRepository.findById(refreshToken.getJwtId())).isEmpty();
		} finally {
			continueSocialLogin.countDown();
		}
	}

	@Test
	void staleProfileUpdateCannotReactivateAnAccountLockedConcurrently() throws Exception {
		TestSession admin = loginAndGetSession("admin@example.com");
		CountDownLatch profileLoaded = new CountDownLatch(1);
		CountDownLatch continueProfileUpdate = new CountDownLatch(1);

		try (ExecutorService executor = Executors.newFixedThreadPool(1)) {
			var profileUpdate = executor.submit(() -> transactionTemplate.executeWithoutResult(transaction -> {
				User staleUser = userRepository.findWithRolesById(learnerId).orElseThrow();
				profileLoaded.countDown();
				awaitLatch(continueProfileUpdate);
				staleUser.updateProfile("Updated Learner", null, null);
				userRepository.saveAndFlush(staleUser);
			}));
			assertThat(profileLoaded.await(10, TimeUnit.SECONDS)).isTrue();
			mockMvc.perform(bulkStatusRequest(admin.accessToken(), List.of(learnerId), false))
					.andExpect(status().isOk());
			continueProfileUpdate.countDown();
			profileUpdate.get(30, TimeUnit.SECONDS);
		} finally {
			continueProfileUpdate.countDown();
		}

		assertThat(isUserActive(learnerId)).isFalse();
		assertThat(userRepository.findById(learnerId).orElseThrow().getFullName()).isEqualTo("Updated Learner");
	}

	@Test
	void concurrentAdminsCannotLockEachOtherAndLeaveNoActiveAdmin() throws Exception {
		TestSession firstAdmin = loginAndGetSession("admin@example.com");
		TestSession secondAdmin = loginAndGetSession("second.admin@example.com");
		CountDownLatch mutexHeld = new CountDownLatch(1);
		CountDownLatch releaseMutex = new CountDownLatch(1);

		try (ExecutorService executor = Executors.newFixedThreadPool(3)) {
			var mutexHolder = executor.submit(() -> transactionTemplate.executeWithoutResult(transaction -> {
				roleRepository.findByNameForUpdate(RoleName.ADMIN).orElseThrow();
				mutexHeld.countDown();
				awaitLatch(releaseMutex);
			}));
			assertThat(mutexHeld.await(10, TimeUnit.SECONDS)).isTrue();
			var firstResult = executor.submit(() -> mockMvc.perform(
					bulkStatusRequest(firstAdmin.accessToken(), List.of(secondAdminId), false)).andReturn());
			var secondResult = executor.submit(() -> mockMvc.perform(
					bulkStatusRequest(secondAdmin.accessToken(), List.of(adminId), false)).andReturn());
			assertThat(awaitLockWaiters("roles", 2)).isTrue();
			releaseMutex.countDown();

			List<Integer> responseStatuses = List.of(
					firstResult.get(30, TimeUnit.SECONDS).getResponse().getStatus(),
					secondResult.get(30, TimeUnit.SECONDS).getResponse().getStatus()
			);
			mutexHolder.get(30, TimeUnit.SECONDS);
			assertThat(responseStatuses).containsExactlyInAnyOrder(200, 409);
		} finally {
			releaseMutex.countDown();
		}

		Integer activeAdminCount = jdbcTemplate.queryForObject(
				"""
						SELECT COUNT(DISTINCT user_role.user_id)
						FROM techverse.user_roles user_role
						JOIN techverse.roles role ON role.id = user_role.role_id
						JOIN techverse.users user_account ON user_account.id = user_role.user_id
						WHERE role.name = 'ADMIN' AND user_account.is_active = true
						""",
				Integer.class
		);
		assertThat(activeAdminCount).isEqualTo(1);
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
		return loginAndGetSession(email).accessToken();
	}

	private TestSession loginAndGetSession(String email) throws Exception {
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
		Cookie refreshCookie = result.getResponse().getCookie("refresh_token");
		assertThat(accessToken).isNotBlank();
		assertThat(refreshCookie).isNotNull();
		return new TestSession(accessToken, refreshCookie.getValue());
	}

	private MockHttpServletRequestBuilder bulkStatusRequest(String accessToken, List<UUID> userIds, boolean active)
			throws Exception {
		return patch("/api/v1/admin/users/bulk-status")
				.header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of("userIds", userIds, "active", active)));
	}

	private void pauseAccessTokenGeneration(UUID userId, CountDownLatch generated, CountDownLatch proceed) {
		doAnswer(invocation -> {
			JwtDetails token = (JwtDetails) invocation.callRealMethod();
			if (userId.equals(invocation.getArgument(0))) {
				generated.countDown();
				awaitLatch(proceed);
			}
			return token;
		}).when(tokenService).generateAccessToken(eq(userId), anySet(), anyString());
	}

	private void pauseRefreshTokenGeneration(UUID userId, CountDownLatch generated, CountDownLatch proceed) {
		doAnswer(invocation -> {
			JwtDetails token = (JwtDetails) invocation.callRealMethod();
			if (userId.equals(invocation.getArgument(0))) {
				generated.countDown();
				awaitLatch(proceed);
			}
			return token;
		}).when(tokenService).generateRefreshToken(eq(userId), anySet(), anyString());
	}

	private boolean awaitLockOperationProgress(Future<?> operation, String table) throws Exception {
		return awaitCondition(() -> operation.isDone() || hasWaitingDatabaseLock(table));
	}

	private boolean awaitLockWaiters(String table, int expectedCount) throws Exception {
		return awaitCondition(() -> countWaitingDatabaseLocks(table) >= expectedCount);
	}

	private boolean awaitCondition(BooleanSupplier condition) throws InterruptedException {
		long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
		while (System.nanoTime() < deadline) {
			if (condition.getAsBoolean()) {
				return true;
			}
			Thread.sleep(25);
		}
		return condition.getAsBoolean();
	}

	private boolean hasWaitingDatabaseLock(String table) {
		return countWaitingDatabaseLocks(table) > 0;
	}

	private int countWaitingDatabaseLocks(String table) {
		Integer count = jdbcTemplate.queryForObject(
				"""
						SELECT COUNT(*)
						FROM pg_stat_activity
						WHERE datname = current_database()
						  AND wait_event_type = 'Lock'
						  AND query ILIKE ?
						""",
				Integer.class,
				"%" + table + "%"
		);
		return count == null ? 0 : count;
	}

	private MockHttpServletRequestBuilder loginRequest(String email) throws Exception {
		return post("/api/v1/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"email", email,
						"password", "SecurePass123!"
				)));
	}

	private void awaitLatch(CountDownLatch latch) {
		try {
			if (!latch.await(15, TimeUnit.SECONDS)) {
				throw new IllegalStateException("Test synchronization latch timed out");
			}
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new IllegalStateException("Test synchronization interrupted", exception);
		}
	}

	private boolean isUserActive(UUID userId) {
		return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
				"SELECT is_active FROM techverse.users WHERE id = ?",
				Boolean.class,
				userId
		));
	}

	private record TestSession(String accessToken, String refreshToken) {
	}
}
