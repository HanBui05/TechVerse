package com.techverse.server.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jwt.SignedJWT;
import com.techverse.server.entity.AuthorProfile;
import com.techverse.server.entity.User;
import com.techverse.server.repository.AuthorProfileRepository;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.context.annotation.Import;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.ObjectMapper;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(AdminAuthorApplicationIntegrationTest.AuthorPermissionProbe.class)
class AdminAuthorApplicationIntegrationTest {
    private static final String ROOT = "/api/v1/admin/author-applications";
    private static final String RESUBMIT = "/api/v1/author-profiles/me/resubmit";
    private static final String AUTHOR_PROBE = "/api/v1/admin/test-only-author-access";
    private static final String BIO = "I build Java backend systems and share practical engineering knowledge with the community.";
    private static final String PASSWORD = "SecurePass123!";

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
    @Container @ServiceConnection(name = "redis")
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired AuthorProfileRepository profiles;
    @Autowired TokenRepository tokens;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    private UUID adminId;
    private UUID secondAdminId;
    private UUID applicantId;
    private UUID applicationId;
    private String adminToken;
    private String applicantToken;

    @BeforeEach
    void setUp() throws Exception {
        tokens.deleteAll();
        users.deleteAll();
        adminId = saveUser("Admin Reviewer", "reviewer@example.com");
        secondAdminId = saveUser("Second Reviewer", "second.reviewer@example.com");
        assignAdmin(adminId);
        assignAdmin(secondAdminId);
        applicantId = saveUser("Author Applicant", "applicant@example.com");
        applicationId = profiles.saveAndFlush(AuthorProfile.create(users.findById(applicantId).orElseThrow(),
                BIO, "Java Backend", "https://example.com/portfolio")).getId();
        adminToken = access(login("reviewer@example.com"));
        applicantToken = access(login("applicant@example.com"));
    }

    @Test
    void adminListsAndReadsPendingApplicationWithoutReviewerOrSensitiveFields() throws Exception {
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                        .param("status", "PENDING").param("keyword", "APPLICANT").param("active", "true")
                        .param("page", "0").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(applicationId.toString()))
                .andExpect(jsonPath("$.data.content[0].version").value(0))
                .andExpect(jsonPath("$.data.content[0].bio").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].password").doesNotExist());
        detail(applicationId).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bio").value(BIO))
                .andExpect(jsonPath("$.data.userId").value(applicantId.toString()))
                .andExpect(jsonPath("$.data.reviewedBy").isEmpty())
                .andExpect(jsonPath("$.data.reviewedAt").isEmpty())
                .andExpect(jsonPath("$.data.password").doesNotExist());
    }

    @Test
    void approvesAtomicallyRecordsReviewerAndRefreshPicksUpAuthorWithoutRevokingLearnerSession() throws Exception {
        MvcResult session = login("applicant@example.com");
        Cookie cookie = session.getResponse().getCookie("refresh_token");
        review(adminToken, applicationId, "APPROVED", "  Meets the requirements.  ", 0)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.reviewedBy").value(adminId.toString()))
                .andExpect(jsonPath("$.data.reviewNote").value("Meets the requirements."))
                .andExpect(jsonPath("$.data.reviewedAt").isNotEmpty());
        assertThat(roleCount("AUTHOR")).isEqualTo(1);
        assertThat(roleCount("LEARNER")).isEqualTo(1);
        mvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, bearer(access(session))))
                .andExpect(status().isOk());
        MvcResult refreshed = mvc.perform(post("/api/v1/auth/refresh").cookie(cookie))
                .andExpect(status().isOk()).andReturn();
        assertThat(SignedJWT.parse(access(refreshed)).getJWTClaimsSet().getStringListClaim("roles"))
                .contains("LEARNER", "AUTHOR");
        assertThat(refreshed.getResponse().getCookie("refresh_token").getValue()).isEqualTo(cookie.getValue());
        review(adminToken, applicationId, "REJECTED", "Another decision", 1)
                .andExpect(status().isConflict());
        assertThat(roleCount("AUTHOR")).isEqualTo(1);
    }

    @Test
    void rejectsWithReasonAndResubmitsSameRowClearingReviewAndBlockingStaleAdminTab() throws Exception {
        review(adminToken, applicationId, "REJECTED", "  Need a fuller portfolio.  ", 0)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.version").value(1));
        assertThat(roleCount("AUTHOR")).isZero();
        mvc.perform(get("/api/v1/author-profiles/me").header(HttpHeaders.AUTHORIZATION, bearer(applicantToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.profile.version").value(1))
                .andExpect(jsonPath("$.data.profile.reviewNote").value("Need a fuller portfolio."));
        resubmit(applicantToken, 1, BIO + " Updated portfolio.")
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(applicationId.toString()))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.reviewNote").isEmpty())
                .andExpect(jsonPath("$.data.reviewedAt").isEmpty());
        assertThat(profiles.count()).isEqualTo(1);
        detail(applicationId).andExpect(status().isOk()).andExpect(jsonPath("$.data.reviewedBy").isEmpty());
        review(adminToken, applicationId, "APPROVED", "Old tab", 0)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AUTHOR_APPLICATION_STALE_VERSION"));
        review(adminToken, applicationId, "APPROVED", "New application reviewed", 2).andExpect(status().isOk());
    }

    @Test
    void rejectRequiresNonblankReasonAndReviewValidatesDecisionVersionAndLength() throws Exception {
        for (Map<String, Object> body : List.<Map<String, Object>>of(
                Map.of("decision", "REJECTED", "expectedVersion", 0),
                Map.of("decision", "REJECTED", "reviewNote", "   ", "expectedVersion", 0),
                Map.of("decision", "PENDING", "expectedVersion", 0),
                Map.of("decision", "SUSPENDED", "expectedVersion", 0),
                Map.of("decision", "APPROVED"),
                Map.of("decision", "APPROVED", "expectedVersion", -1),
                Map.of("decision", "APPROVED", "expectedVersion", 0, "reviewNote", "x".repeat(2001)))) {
            sendPatch(ROOT + "/" + applicationId + "/review", adminToken, body).andExpect(status().isBadRequest());
        }
        assertThat(profiles.findById(applicationId).orElseThrow().getStatus().name()).isEqualTo("PENDING");
        assertThat(roleCount("AUTHOR")).isZero();
        sendPatch(ROOT + "/" + applicationId + "/review", adminToken,
                Map.of("decision", "APPROVED", "expectedVersion", 0)).andExpect(status().isOk());
    }

    @Test
    void authorReviewAndReadsRequireAdminWhileResubmitRequiresAuthenticatedOwner() throws Exception {
        mvc.perform(get(ROOT)).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(applicantToken))).andExpect(status().isForbidden());
        mvc.perform(get(ROOT + "/" + applicationId).header(HttpHeaders.AUTHORIZATION, bearer(applicantToken)))
                .andExpect(status().isForbidden());
        review(applicantToken, applicationId, "APPROVED", "", 0).andExpect(status().isForbidden());
        sendPatch(RESUBMIT, null, Map.of("bio", BIO, "expertise", "Java", "expectedVersion", 0))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reviewRejectsSelfInactiveAndMissingApplications() throws Exception {
        UUID ownApplication = profiles.saveAndFlush(AuthorProfile.create(users.findById(adminId).orElseThrow(),
                BIO, "Java", null)).getId();
        review(adminToken, ownApplication, "APPROVED", "", 0)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("AUTHOR_SELF_REVIEW_NOT_ALLOWED"));
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", applicantId);
        review(adminToken, applicationId, "APPROVED", "", 0)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("USER_INACTIVE"));
        detail(UUID.randomUUID()).andExpect(status().isNotFound());
        review(adminToken, UUID.randomUUID(), "APPROVED", "", 0).andExpect(status().isNotFound());
    }

    @Test
    void onlyRejectedOwnerCanResubmitAndPayloadCannotSelectAnotherUser() throws Exception {
        resubmit(applicantToken, 0, BIO).andExpect(status().isConflict());
        review(adminToken, applicationId, "REJECTED", "Please add experience", 0).andExpect(status().isOk());
        resubmit(adminToken, 1, BIO).andExpect(status().isNotFound());
        sendPatch(RESUBMIT, applicantToken, Map.of("bio", "short", "expertise", "Java", "expectedVersion", 1))
                .andExpect(status().isBadRequest());
        sendPatch(RESUBMIT, applicantToken, Map.of("bio", BIO, "expertise", "Java"))
                .andExpect(status().isBadRequest());
        resubmit(applicantToken, 0, BIO).andExpect(status().isConflict());
        resubmit(applicantToken, 1, BIO).andExpect(status().isOk());
        resubmit(applicantToken, 2, BIO).andExpect(status().isConflict());
        assertThat(profiles.count()).isEqualTo(1);
    }

    @Test
    void approvedAndSuspendedProfilesCannotResubmit() throws Exception {
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        resubmit(applicantToken, 1, BIO).andExpect(status().isConflict());
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE id=?", applicationId);
        resubmit(applicantToken, 1, BIO).andExpect(status().isConflict());
    }

    @Test
    void listUsesLiteralKeywordFiltersAllStatesAndValidatesPaginationAndSort() throws Exception {
        UUID literalUser = saveUser("Literal%_Name", "literal@example.com");
        profiles.saveAndFlush(AuthorProfile.create(users.findById(literalUser).orElseThrow(), BIO, "Java", null));
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).param("keyword", "%_"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        review(adminToken, applicationId, "REJECTED", "Missing experience", 0).andExpect(status().isOk());
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).param("status", "REJECTED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        detail(applicationId).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("REJECTED"));
        for (Map.Entry<String, String> param : Map.of("size", "101", "page", "-1", "sortBy", "PASSWORD",
                "direction", "WRONG", "status", "NOT_APPLIED").entrySet()) {
            mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).param(param.getKey(), param.getValue()))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void twoAdminsWithOpposingDecisionsHaveOneWinnerAndConsistentRole() throws Exception {
        String secondToken = access(login("second.reviewer@example.com"));
        List<MvcResult> results = parallel(2, index -> review(index == 0 ? adminToken : secondToken, applicationId,
                index == 0 ? "APPROVED" : "REJECTED", "Reviewed by " + index, 0).andReturn());
        assertThat(results.stream().map(r -> r.getResponse().getStatus()).toList()).containsExactlyInAnyOrder(200, 409);
        String currentStatus = profiles.findById(applicationId).orElseThrow().getStatus().name();
        assertThat(roleCount("AUTHOR")).isEqualTo(currentStatus.equals("APPROVED") ? 1 : 0);
        UUID reviewer = jdbc.queryForObject("SELECT reviewed_by FROM techverse.author_profiles WHERE id=?", UUID.class, applicationId);
        assertThat(reviewer).isEqualTo(results.get(0).getResponse().getStatus() == 200 ? adminId : secondAdminId);
    }

    @Test
    void concurrentResubmissionHasOneWinnerAndOneRow() throws Exception {
        review(adminToken, applicationId, "REJECTED", "Need more details", 0).andExpect(status().isOk());
        List<MvcResult> results = parallel(6, index -> resubmit(applicantToken, 1, BIO + " Revision " + index).andReturn());
        assertThat(results.stream().filter(r -> r.getResponse().getStatus() == 200).count()).isEqualTo(1);
        assertThat(results.stream().filter(r -> r.getResponse().getStatus() == 409).count()).isEqualTo(5);
        assertThat(profiles.count()).isEqualTo(1);
        assertThat(profiles.findById(applicationId).orElseThrow().getStatus().name()).isEqualTo("PENDING");
    }

    @Test
    void staleResubmissionCannotOverwriteANewerRejectedCycle() throws Exception {
        review(adminToken, applicationId, "REJECTED", "First rejection", 0).andExpect(status().isOk());
        resubmit(applicantToken, 1, BIO + " New revision").andExpect(status().isOk());
        review(adminToken, applicationId, "REJECTED", "Second rejection", 2).andExpect(status().isOk());
        resubmit(applicantToken, 1, BIO + " Old tab").andExpect(status().isConflict());
        assertThat(profiles.findById(applicationId).orElseThrow().getBio()).isEqualTo(BIO + " New revision");
    }

    @Test
    void missingAuthorRoleRollsBackReview() throws Exception {
        UUID authorRole = jdbc.queryForObject("SELECT id FROM techverse.roles WHERE name='AUTHOR'", UUID.class);
        jdbc.update("DELETE FROM techverse.roles WHERE id=?", authorRole);
        try {
            review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isInternalServerError());
            assertThat(profiles.findById(applicationId).orElseThrow().getStatus().name()).isEqualTo("PENDING");
            detail(applicationId).andExpect(status().isOk()).andExpect(jsonPath("$.data.version").value(0))
                    .andExpect(jsonPath("$.data.reviewedBy").isEmpty());
        } finally {
            jdbc.update("INSERT INTO techverse.roles(id,name) VALUES (?, 'AUTHOR')", authorRole);
        }
    }

    @Test
    void reviewRacingAccountLockCannotLeaveLockedAccountAccessible() throws Exception {
        List<MvcResult> results = parallel(2, index -> index == 0
                ? review(adminToken, applicationId, "APPROVED", "Reviewed", 0).andReturn()
                : sendPatch("/api/v1/admin/users/bulk-status", adminToken,
                        Map.of("userIds", List.of(applicantId.toString()), "active", false)).andReturn());
        assertThat(results.get(1).getResponse().getStatus()).isEqualTo(200);
        assertThat(results.get(0).getResponse().getStatus()).isIn(200, 403);
        assertThat(users.findById(applicantId).orElseThrow().isActive()).isFalse();
        mvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, bearer(applicantToken)))
                .andExpect(status().isUnauthorized());
        assertThat(profiles.findById(applicationId).orElseThrow().getStatus().name())
                .isEqualTo(results.get(0).getResponse().getStatus() == 200 ? "APPROVED" : "PENDING");
    }

    @Test
    void suspensionAndRestorationKeepInitialReviewAndExposeLatestCycleWithoutLeakingAdminToOwner() throws Exception {
        review(adminToken, applicationId, "APPROVED", "Initial approval", 0).andExpect(status().isOk());
        String reviewedAt = mapper.readTree(detail(applicationId).andReturn().getResponse().getContentAsString())
                .at("/data/reviewedAt").asText();
        changeAuthorStatus("suspend", adminToken, applicationId, "  Repeated policy violations  ", 1)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("SUSPENDED"))
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.suspensionReason").value("Repeated policy violations"))
                .andExpect(jsonPath("$.data.suspendedBy").value(adminId.toString()))
                .andExpect(jsonPath("$.data.suspendedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.reviewNote").value("Initial approval"))
                .andExpect(jsonPath("$.data.reviewedAt").value(reviewedAt));
        mvc.perform(get("/api/v1/author-profiles/me").header(HttpHeaders.AUTHORIZATION, bearer(applicantToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.applicationStatus").value("SUSPENDED"))
                .andExpect(jsonPath("$.data.profile.suspensionReason").value("Repeated policy violations"))
                .andExpect(jsonPath("$.data.profile.suspendedBy").doesNotExist());
        changeAuthorStatus("restore", adminToken, applicationId, "  Violations resolved  ", 2)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.version").value(3))
                .andExpect(jsonPath("$.data.restorationNote").value("Violations resolved"))
                .andExpect(jsonPath("$.data.restoredBy").value(adminId.toString()))
                .andExpect(jsonPath("$.data.restoredAt").isNotEmpty())
                .andExpect(jsonPath("$.data.suspensionReason").value("Repeated policy violations"));
        mvc.perform(get("/api/v1/admin/users/" + applicantId).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.authorProfile.restoredBy").value(adminId.toString()));
        changeAuthorStatus("suspend", adminToken, applicationId, "New violation", 3)
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.restorationNote").isEmpty())
                .andExpect(jsonPath("$.data.restoredBy").isEmpty()).andExpect(jsonPath("$.data.restoredAt").isEmpty())
                .andExpect(jsonPath("$.data.reviewedBy").value(adminId.toString()))
                .andExpect(jsonPath("$.data.reviewNote").value("Initial approval"));
        assertThat(roleCount("AUTHOR")).isEqualTo(1);
        assertThat(roleCount("LEARNER")).isEqualTo(1);
        assertThat(profiles.count()).isEqualTo(1);
    }

    @Test
    void onlyApprovedCanSuspendAndOnlySuspendedCanRestore() throws Exception {
        for (String state : List.of("PENDING", "REJECTED")) {
            jdbc.update("UPDATE techverse.author_profiles SET status=? WHERE id=?", state, applicationId);
            changeAuthorStatus("suspend", adminToken, applicationId, "Reason", 0).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("AUTHOR_NOT_APPROVED"));
            changeAuthorStatus("restore", adminToken, applicationId, "Reason", 0).andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("AUTHOR_NOT_SUSPENDED"));
        }
        jdbc.update("UPDATE techverse.author_profiles SET status='PENDING' WHERE id=?", applicationId);
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        changeAuthorStatus("restore", adminToken, applicationId, "Reason", 1).andExpect(status().isConflict());
        changeAuthorStatus("suspend", adminToken, applicationId, "Reason", 1).andExpect(status().isOk());
        changeAuthorStatus("suspend", adminToken, applicationId, "Reason", 2).andExpect(status().isConflict());
        resubmit(applicantToken, 2, BIO).andExpect(status().isConflict());
        review(adminToken, applicationId, "APPROVED", "", 2).andExpect(status().isConflict());
    }

    @Test
    void statusActionsValidateReasonNoteAndVersionBeforeMutation() throws Exception {
        for (String action : List.of("suspend", "restore")) {
            String field = action.equals("suspend") ? "reason" : "note";
            for (Map<String, Object> body : List.<Map<String, Object>>of(
                    Map.of("expectedVersion", 0), Map.of(field, "  ", "expectedVersion", 0),
                    Map.of(field, "x".repeat(2001), "expectedVersion", 0), Map.of(field, "Reason"),
                    Map.of(field, "Reason", "expectedVersion", -1))) {
                sendPatch(ROOT + "/" + applicationId + "/" + action, adminToken, body)
                        .andExpect(status().isBadRequest());
            }
        }
        assertThat(profiles.findById(applicationId).orElseThrow().getStatus().name()).isEqualTo("PENDING");
    }

    @Test
    void statusActionsRequireAdminEvenForAuthorModeratorAndStaleAdminClaims() throws Exception {
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        String authorToken = access(login("applicant@example.com"));
        UUID moderatorId = saveUser("Moderator", "moderator@example.com");
        jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name='MODERATOR'", moderatorId);
        String moderatorToken = access(login("moderator@example.com"));
        for (String action : List.of("suspend", "restore")) {
            changeAuthorStatus(action, null, applicationId, "Reason", 1).andExpect(status().isUnauthorized());
            for (String token : List.of(applicantToken, authorToken, moderatorToken)) {
                changeAuthorStatus(action, token, applicationId, "Reason", 1).andExpect(status().isForbidden());
            }
        }
        jdbc.update("DELETE FROM techverse.user_roles WHERE user_id=? AND role_id=(SELECT id FROM techverse.roles WHERE name='ADMIN')", adminId);
        changeAuthorStatus("suspend", adminToken, applicationId, "Reason", 1).andExpect(status().isForbidden());
        assertThat(profiles.findById(applicationId).orElseThrow().getStatus().name()).isEqualTo("APPROVED");
    }

    @Test
    void adminsCannotSuspendOrRestoreTheirOwnAuthorProfile() throws Exception {
        UUID ownProfile = profiles.saveAndFlush(AuthorProfile.create(users.findById(adminId).orElseThrow(), BIO, "Java", null)).getId();
        String secondToken = access(login("second.reviewer@example.com"));
        review(secondToken, ownProfile, "APPROVED", "", 0).andExpect(status().isOk());
        changeAuthorStatus("suspend", adminToken, ownProfile, "Reason", 1).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTHOR_SELF_STATUS_CHANGE_NOT_ALLOWED"));
        changeAuthorStatus("suspend", secondToken, ownProfile, "Reason", 1).andExpect(status().isOk());
        changeAuthorStatus("restore", adminToken, ownProfile, "Resolved", 2).andExpect(status().isForbidden());
        changeAuthorStatus("restore", secondToken, ownProfile, "Resolved", 2).andExpect(status().isOk());
    }

    @Test
    void statusActionsHandleMissingAndMalformedIds() throws Exception {
        for (String action : List.of("suspend", "restore")) {
            changeAuthorStatus(action, adminToken, UUID.randomUUID(), "Reason", 0).andExpect(status().isNotFound());
            sendPatch(ROOT + "/not-a-uuid/" + action, adminToken,
                    Map.of(action.equals("suspend") ? "reason" : "note", "Reason", "expectedVersion", 0))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void concurrentSuspensionsAndRestorationsHaveOnlyOneWinnerPerVersion() throws Exception {
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        String secondToken = access(login("second.reviewer@example.com"));
        for (String action : List.of("suspend", "restore")) {
            long version = action.equals("suspend") ? 1 : 2;
            List<MvcResult> results = parallel(2, index -> changeAuthorStatus(action,
                    index == 0 ? adminToken : secondToken, applicationId, "Admin " + index, version).andReturn());
            assertThat(results.stream().map(r -> r.getResponse().getStatus()).toList()).containsExactlyInAnyOrder(200, 409);
            UUID recordedActor = jdbc.queryForObject("SELECT " + (action.equals("suspend") ? "suspended_by" : "restored_by")
                    + " FROM techverse.author_profiles WHERE id=?", UUID.class, applicationId);
            assertThat(recordedActor).isEqualTo(results.get(0).getResponse().getStatus() == 200 ? adminId : secondAdminId);
        }
        assertThat(profiles.findById(applicationId).orElseThrow().getStatus().name()).isEqualTo("APPROVED");
        assertThat(roleCount("AUTHOR")).isEqualTo(1);
    }

    @Test
    void staleStatusRequestsCannotActOnANewerSuspensionCycle() throws Exception {
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        changeAuthorStatus("suspend", adminToken, applicationId, "First", 1).andExpect(status().isOk());
        changeAuthorStatus("restore", adminToken, applicationId, "Resolved", 2).andExpect(status().isOk());
        changeAuthorStatus("suspend", adminToken, applicationId, "Old tab", 1).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("AUTHOR_APPLICATION_STALE_VERSION"));
        changeAuthorStatus("suspend", adminToken, applicationId, "Second", 3).andExpect(status().isOk());
        changeAuthorStatus("restore", adminToken, applicationId, "Old tab", 2).andExpect(status().isConflict());
    }

    @Test
    void oldJwtAuthorAuthorityTracksApprovedStatusAndCurrentRoleMembership() throws Exception {
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        String authorToken = access(login("applicant@example.com"));
        authorProbe(authorToken).andExpect(status().isOk());
        for (String state : List.of("SUSPENDED", "PENDING", "REJECTED")) {
            jdbc.update("UPDATE techverse.author_profiles SET status=? WHERE id=?", state, applicationId);
            authorProbe(authorToken).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, bearer(authorToken)))
                    .andExpect(status().isOk());
        }
        jdbc.update("UPDATE techverse.author_profiles SET status='APPROVED' WHERE id=?", applicationId);
        authorProbe(authorToken).andExpect(status().isOk());
        jdbc.update("DELETE FROM techverse.user_roles WHERE user_id=? AND role_id=(SELECT id FROM techverse.roles WHERE name='AUTHOR')", applicantId);
        authorProbe(authorToken).andExpect(status().isForbidden());
        // A profile alone must never grant AUTHOR to a JWT that did not have that claim.
        authorProbe(applicantToken).andExpect(status().isForbidden());
    }

    @Test
    void suspensionPreservesLearnerSessionsAndRefreshLoginCannotRegainAuthorUntilRestored() throws Exception {
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        MvcResult session = login("applicant@example.com");
        String oldAuthorToken = access(session);
        Cookie refresh = session.getResponse().getCookie("refresh_token");
        changeAuthorStatus("suspend", adminToken, applicationId, "Violation", 1).andExpect(status().isOk());
        authorProbe(oldAuthorToken).andExpect(status().isForbidden());
        MvcResult duringSuspension = mvc.perform(post("/api/v1/auth/refresh").cookie(refresh))
                .andExpect(status().isOk()).andReturn();
        assertThat(SignedJWT.parse(access(duringSuspension)).getJWTClaimsSet().getStringListClaim("roles"))
                .contains("LEARNER").doesNotContain("AUTHOR");
        assertThat(duringSuspension.getResponse().getCookie("refresh_token").getValue()).isEqualTo(refresh.getValue());
        MvcResult suspendedLogin = login("applicant@example.com");
        assertThat(SignedJWT.parse(access(suspendedLogin)).getJWTClaimsSet().getStringListClaim("roles"))
                .contains("LEARNER").doesNotContain("AUTHOR");
        authorProbe(access(suspendedLogin)).andExpect(status().isForbidden());
        changeAuthorStatus("restore", adminToken, applicationId, "Resolved", 2).andExpect(status().isOk());
        authorProbe(access(duringSuspension)).andExpect(status().isForbidden());
        MvcResult restoredRefresh = mvc.perform(post("/api/v1/auth/refresh").cookie(refresh))
                .andExpect(status().isOk()).andReturn();
        assertThat(SignedJWT.parse(access(restoredRefresh)).getJWTClaimsSet().getStringListClaim("roles"))
                .contains("LEARNER", "AUTHOR");
        authorProbe(access(restoredRefresh)).andExpect(status().isOk());
        authorProbe(oldAuthorToken).andExpect(status().isOk());
    }

    @Test
    void suspensionRacingAccountLockAndRestorationNeverUnlockUser() throws Exception {
        review(adminToken, applicationId, "APPROVED", "", 0).andExpect(status().isOk());
        List<MvcResult> results = parallel(2, index -> index == 0
                ? changeAuthorStatus("suspend", adminToken, applicationId, "Violation", 1).andReturn()
                : sendPatch("/api/v1/admin/users/bulk-status", adminToken,
                        Map.of("userIds", List.of(applicantId.toString()), "active", false)).andReturn());
        assertThat(results.stream().map(r -> r.getResponse().getStatus()).toList()).containsOnly(200);
        changeAuthorStatus("restore", adminToken, applicationId, "Resolved", 2).andExpect(status().isOk());
        assertThat(users.findById(applicantId).orElseThrow().isActive()).isFalse();
        mvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, bearer(applicantToken)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void databaseFlushFailureRollsBackStatusVersionAndAuditForBothActions() throws Exception {
        review(adminToken, applicationId, "APPROVED", "Initial approval", 0).andExpect(status().isOk());
        jdbc.execute("""
                CREATE FUNCTION techverse.test_reject_author_status() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'simulated author status write failure'; END; $$
                """);
        try {
            for (String action : List.of("suspend", "restore")) {
                jdbc.execute("CREATE TRIGGER test_reject_author_status BEFORE UPDATE ON techverse.author_profiles "
                        + "FOR EACH ROW EXECUTE FUNCTION techverse.test_reject_author_status()");
                long version = action.equals("suspend") ? 1 : 2;
                changeAuthorStatus(action, adminToken, applicationId, "Reason", version)
                        .andExpect(status().isInternalServerError());
                detail(applicationId).andExpect(status().isOk()).andExpect(jsonPath("$.data.version").value(version))
                        .andExpect(jsonPath("$.data.status").value(action.equals("suspend") ? "APPROVED" : "SUSPENDED"))
                        .andExpect(jsonPath("$.data.restoredAt").isEmpty())
                        .andExpect(jsonPath("$.data.reviewNote").value("Initial approval"));
                jdbc.execute("DROP TRIGGER test_reject_author_status ON techverse.author_profiles");
                if (action.equals("suspend")) {
                    detail(applicationId).andExpect(jsonPath("$.data.suspendedAt").isEmpty());
                    changeAuthorStatus("suspend", adminToken, applicationId, "Violation", 1).andExpect(status().isOk());
                }
            }
        } finally {
            jdbc.execute("DROP TRIGGER IF EXISTS test_reject_author_status ON techverse.author_profiles");
            jdbc.execute("DROP FUNCTION techverse.test_reject_author_status()");
        }
    }

    private ResultActions changeAuthorStatus(String action, String token, UUID id, String note, long version) throws Exception {
        return sendPatch(ROOT + "/" + id + "/" + action, token,
                Map.of(action.equals("suspend") ? "reason" : "note", note, "expectedVersion", version));
    }

    private ResultActions authorProbe(String token) throws Exception {
        return mvc.perform(get(AUTHOR_PROBE).header(HttpHeaders.AUTHORIZATION, bearer(token)));
    }

    // Exercises the real filter chain + method security; never included in the production artifact.
    @TestComponent
    @RestController
    public static class AuthorPermissionProbe {
        @GetMapping(AUTHOR_PROBE)
        @PreAuthorize("hasRole('AUTHOR')")
        public Map<String, Boolean> getAuthorResource() { return Map.of("allowed", true); }
    }

    private UUID saveUser(String name, String email) {
        return users.saveAndFlush(User.createLocalAccount(name, email, encoder.encode(PASSWORD))).getId();
    }

    private void assignAdmin(UUID userId) {
        jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name='ADMIN'", userId);
    }

    private MvcResult login(String email) throws Exception {
        return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn();
    }

    private String access(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }

    private String bearer(String token) { return "Bearer " + token; }
    private ResultActions detail(UUID id) throws Exception {
        return mvc.perform(get(ROOT + "/" + id).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)));
    }
    private ResultActions review(String token, UUID id, String decision, String note, long version) throws Exception {
        return sendPatch(ROOT + "/" + id + "/review", token,
                Map.of("decision", decision, "reviewNote", note, "expectedVersion", version));
    }
    private ResultActions resubmit(String token, long version, String bio) throws Exception {
        return sendPatch(RESUBMIT, token, Map.of("bio", bio, "expertise", "Java Backend",
                "portfolioUrl", "https://example.com/new-portfolio", "expectedVersion", version));
    }
    private ResultActions sendPatch(String path, String token, Object body) throws Exception {
        var request = patch(path).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        if (token != null) request.header(HttpHeaders.AUTHORIZATION, bearer(token));
        return mvc.perform(request);
    }
    private int roleCount(String role) {
        return jdbc.queryForObject("SELECT count(*) FROM techverse.user_roles ur JOIN techverse.roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.name=?",
                Integer.class, applicantId, role);
    }
    private List<MvcResult> parallel(int count, CheckedRequest request) throws Exception {
        try (var pool = Executors.newFixedThreadPool(count)) {
            var ready = new CountDownLatch(count);
            var start = new CountDownLatch(1);
            var futures = new ArrayList<java.util.concurrent.Future<MvcResult>>();
            for (int i = 0; i < count; i++) {
                int index = i;
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                    return request.run(index);
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var results = new ArrayList<MvcResult>();
            for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        }
    }
    @FunctionalInterface private interface CheckedRequest { MvcResult run(int index) throws Exception; }
}
