package com.techverse.server.moderator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.entity.User;
import com.techverse.server.repository.UserRepository;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.concurrent.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ModeratorArticleIntegrationTest {
    static final String ROOT = "/api/v1/moderator/articles";
    static final String AUTHOR = "/api/v1/author/articles";

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Container
    @ServiceConnection(name = "redis")
    static GenericContainer<?> redis =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    UUID author, moderator, topic, tag;
    String authorToken, modToken, secondModToken, learnerToken, adminToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute(
                "INSERT INTO techverse.roles(name) VALUES"
                        + " ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        author = user("author@example.com", "AUTHOR");
        moderator = user("mod@example.com", "MODERATOR");
        user("second@example.com", "MODERATOR");
        user("learner@example.com", null);
        user("admin@example.com", "ADMIN");
        authorToken = login("author@example.com");
        modToken = login("mod@example.com");
        secondModToken = login("second@example.com");
        learnerToken = login("learner@example.com");
        adminToken = login("admin@example.com");
        topic =
                jdbc.queryForObject(
                        "INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id",
                        UUID.class);
        tag =
                jdbc.queryForObject(
                        "INSERT INTO techverse.tags(name) VALUES ('Java') RETURNING id",
                        UUID.class);
    }

    @Test
    void roleAndAuthenticationRequiredForAllRoutes() throws Exception {
        UUID id = article("SUBMIT", "Secured");
        for (String t : List.of(learnerToken, authorToken, adminToken)) {
            list(t).andExpect(status().isForbidden());
            detail(t, id).andExpect(status().isForbidden());
            review(t, id, "APPROVE", "0".repeat(64), null).andExpect(status().isForbidden());
        }
        mvc.perform(get(ROOT)).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT + "/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(
                        patch(ROOT + "/" + id + "/review")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{} "))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void revokedModeratorRoleIsNotTrustedFromOldJwt() throws Exception {
        UUID id = article("SUBMIT", "Title");
        String snapshot = snapshot(id);
        jdbc.update(
                "DELETE FROM techverse.user_roles WHERE user_id=? AND role_id=(SELECT id FROM"
                        + " techverse.roles WHERE name='MODERATOR')",
                moderator);
        list(modToken).andExpect(status().isForbidden());
        detail(modToken, id).andExpect(status().isForbidden());
        review(modToken, id, "APPROVE", snapshot, null).andExpect(status().isForbidden());
        assertThat(state(id)).isEqualTo("PENDING");
    }

    @Test
    void listDefaultsToAllSubmittedStatusesAndNeverLeaksPrivateDataOrDrafts() throws Exception {
        UUID pending = article("SUBMIT", "Review me");
        UUID draft = article("SAVE", "Private draft");
        UUID changes = article("SUBMIT", "Needs changes");
        review(modToken, changes, "REQUEST_CHANGES", snapshot(changes), "Add an example")
                .andExpect(status().isOk());
        UUID published = article("SUBMIT", "Published article");
        review(modToken, published, "APPROVE", snapshot(published), null)
                .andExpect(status().isOk());
        UUID hidden = article("SUBMIT", "Hidden article");
        UUID removed = article("SUBMIT", "Removed article");
        // These read-only statuses have no transition endpoint in the current module.
        jdbc.update("UPDATE techverse.articles SET status='HIDDEN' WHERE id=?", hidden);
        jdbc.update("UPDATE techverse.articles SET status='REMOVED' WHERE id=?", removed);
        list(modToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(5))
                .andExpect(
                        jsonPath("$.data.content[*].id")
                                .value(
                                        org.hamcrest.Matchers.containsInAnyOrder(
                                                pending.toString(),
                                                changes.toString(),
                                                published.toString(),
                                                hidden.toString(),
                                                removed.toString())))
                .andExpect(jsonPath("$.data.content[0].author.id").value(author.toString()))
                .andExpect(jsonPath("$.data.content[0].author.email").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].author.password").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].content").doesNotExist());
        for (var entry :
                Map.of(
                                "PENDING",
                                pending,
                                "CHANGES_REQUESTED",
                                changes,
                                "PUBLISHED",
                                published,
                                "HIDDEN",
                                hidden,
                                "REMOVED",
                                removed)
                        .entrySet()) {
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", bearer(modToken))
                                    .param("status", entry.getKey()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalElements").value(1))
                    .andExpect(jsonPath("$.data.content[0].id").value(entry.getValue().toString()));
        }
        detail(modToken, draft).andExpect(status().isNotFound());
        detail(modToken, UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void listWithoutStatusStillReturnsPublishedWhenNoPendingArticlesExist() throws Exception {
        UUID published = article("SUBMIT", "Only published article");
        review(modToken, published, "APPROVE", snapshot(published), null)
                .andExpect(status().isOk());
        article("SAVE", "Private draft");
        list(modToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(published.toString()));
        mvc.perform(get(ROOT).header("Authorization", bearer(modToken)).param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void listFiltersPaginationAndLiteralSearchAreCorrect() throws Exception {
        UUID id = article("SUBMIT", "Java 100%_safe");
        article("SUBMIT", "Java 100xyzsafe");
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(modToken))
                                .param("keyword", "100%_")
                                .param("authorId", author.toString())
                                .param("topicId", topic.toString())
                                .param("tagId", tag.toString())
                                .param("createdFrom", "2020-01-01T00:00:00Z")
                                .param("createdTo", "2099-01-01T00:00:00Z")
                                .param("size", "1")
                                .param("sortBy", "TITLE")
                                .param("direction", "ASC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(id.toString()));
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(modToken))
                                .param("authorId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
        mvc.perform(get(ROOT).header("Authorization", bearer(modToken)).param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.hasNext").value(true));
    }

    @Test
    void invalidFiltersReturnBadRequest() throws Exception {
        for (Map<String, String> params :
                List.of(
                        Map.of("status", "DRAFT"),
                        Map.of("status", "APPROVE"),
                        Map.of("size", "101"),
                        Map.of("page", "-1"),
                        Map.of("sortBy", "password"),
                        Map.of(
                                "createdFrom",
                                "2099-01-01T00:00:00Z",
                                "createdTo",
                                "2020-01-01T00:00:00Z"))) {
            var request = get(ROOT).header("Authorization", bearer(modToken));
            params.forEach(request::param);
            mvc.perform(request).andExpect(status().isBadRequest());
        }
    }

    @Test
    void approvalPublishesWithReviewerAuditAndIsVisibleToAuthor() throws Exception {
        UUID id = article("SUBMIT", "Markdown code");
        detail(modToken, id)
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.data.article.content")
                                .value("# Java\n```java\nint i = 1;\n```"))
                .andExpect(jsonPath("$.data.article.tags[0].id").value(tag.toString()));
        review(modToken, id, "APPROVE", snapshot(id), " Ready ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.article.reviewedBy").value(moderator.toString()))
                .andExpect(jsonPath("$.data.article.updatedBy").value(moderator.toString()))
                .andExpect(jsonPath("$.data.article.reviewedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.article.publishedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.article.moderationNote").value("Ready"));
        mvc.perform(get(AUTHOR + "/" + id).header("Authorization", bearer(authorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(modToken))
                                .param("status", "PUBLISHED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void feedbackAndIdenticalResubmissionRejectOldTabToken() throws Exception {
        UUID id = article("SUBMIT", "Unchanged title");
        String old = snapshot(id);
        review(modToken, id, "REQUEST_CHANGES", old, " Add explanation ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.status").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.data.article.moderationNote").value("Add explanation"))
                .andExpect(jsonPath("$.data.article.publishedAt").isEmpty());
        mvc.perform(
                        patch(AUTHOR + "/" + id)
                                .header("Authorization", bearer(authorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"action\":\"SUBMIT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
        review(modToken, id, "APPROVE", old, null).andExpect(status().isConflict());
        assertThat(state(id)).isEqualTo("PENDING");
        review(modToken, id, "APPROVE", snapshot(id), null).andExpect(status().isOk());
    }

    @Test
    void onlyPendingArticlesCanBeReviewedAndSnapshotMustMatch() throws Exception {
        UUID id = article("SUBMIT", "Title");
        review(modToken, id, "APPROVE", "0".repeat(64), null).andExpect(status().isConflict());
        String valid = snapshot(id);
        review(modToken, id, "APPROVE", valid, null).andExpect(status().isOk());
        review(modToken, id, "REQUEST_CHANGES", valid, "Again").andExpect(status().isConflict());
        UUID draft = article("SAVE", "Draft");
        review(modToken, draft, "APPROVE", valid, null).andExpect(status().isNotFound());
        review(modToken, UUID.randomUUID(), "APPROVE", valid, null)
                .andExpect(status().isNotFound());
    }

    @Test
    void feedbackDecisionAndSnapshotValidationDoNotChangeArticle() throws Exception {
        UUID id = article("SUBMIT", "Title");
        String token = snapshot(id);
        review(modToken, id, "REQUEST_CHANGES", token, null).andExpect(status().isBadRequest());
        review(modToken, id, "REQUEST_CHANGES", token, "   ").andExpect(status().isBadRequest());
        review(modToken, id, "APPROVE", token, "x".repeat(2001)).andExpect(status().isBadRequest());
        review(modToken, id, "REJECT", token, "Note").andExpect(status().isBadRequest());
        review(modToken, id, "APPROVE", "", null).andExpect(status().isBadRequest());
        mvc.perform(
                        patch(ROOT + "/" + id + "/review")
                                .header("Authorization", bearer(modToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isBadRequest());
        assertThat(state(id)).isEqualTo("PENDING");
    }

    @Test
    void moderatorCannotReviewOwnArticle() throws Exception {
        UUID id = article("SUBMIT", "Self");
        jdbc.update(
                "INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles"
                        + " WHERE name='MODERATOR'",
                author);
        review(login("author@example.com"), id, "APPROVE", snapshot(id), null)
                .andExpect(status().isForbidden());
    }

    @Test
    void inactiveAssociationsPreventApprovalButAllowFeedback() throws Exception {
        for (String table : List.of("topics", "tags")) {
            UUID id = article("SUBMIT", table);
            String snapshot = snapshot(id);
            jdbc.update("UPDATE techverse." + table + " SET is_active=false");
            review(modToken, id, "APPROVE", snapshot, null).andExpect(status().isConflict());
            review(modToken, id, "REQUEST_CHANGES", snapshot, "Please choose active options")
                    .andExpect(status().isOk());
            jdbc.update("UPDATE techverse." + table + " SET is_active=true");
        }
    }

    @Test
    void suspendedOrInactiveAuthorCannotBePublishedButCanReceiveFeedback() throws Exception {
        for (String update :
                List.of(
                        "UPDATE techverse.users SET is_active=false WHERE id=?",
                        "UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE"
                                + " user_id=?")) {
            UUID id = article("SUBMIT", "Eligibility");
            String snapshot = snapshot(id);
            jdbc.update(update, author);
            review(modToken, id, "APPROVE", snapshot, null).andExpect(status().isConflict());
            review(modToken, id, "REQUEST_CHANGES", snapshot, "Contact support")
                    .andExpect(status().isOk());
            jdbc.update("UPDATE techverse.users SET is_active=true WHERE id=?", author);
            jdbc.update(
                    "UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?",
                    author);
        }
    }

    @Test
    void revokedAuthorRoleCannotBePublished() throws Exception {
        UUID id = article("SUBMIT", "Role removed");
        String snapshot = snapshot(id);
        jdbc.update(
                "DELETE FROM techverse.user_roles WHERE user_id=? AND role_id=(SELECT id FROM"
                        + " techverse.roles WHERE name='AUTHOR')",
                author);
        review(modToken, id, "APPROVE", snapshot, null).andExpect(status().isConflict());
    }

    @Test
    void twoModeratorsRaceOnlyOneCanChangePendingArticle() throws Exception {
        UUID id = article("SUBMIT", "Concurrent");
        String snapshot = snapshot(id);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            List<Future<Integer>> outcomes = new ArrayList<>();
            for (String t : List.of(modToken, secondModToken))
                outcomes.add(
                        pool.submit(
                                () -> {
                                    ready.countDown();
                                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                                    return review(t, id, "APPROVE", snapshot, null)
                                            .andReturn()
                                            .getResponse()
                                            .getStatus();
                                }));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(
                            List.of(
                                    outcomes.get(0).get(40, TimeUnit.SECONDS),
                                    outcomes.get(1).get(40, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        assertThat(state(id)).isEqualTo("PUBLISHED");
    }

    private UUID user(String email, String role) {
        UUID id =
                users.saveAndFlush(
                                User.createLocalAccount(
                                        "Test user", email, encoder.encode("SecurePass123!")))
                        .getId();
        if (role != null)
            jdbc.update(
                    "INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM"
                            + " techverse.roles WHERE name=?",
                    id,
                    role);
        if ("AUTHOR".equals(role))
            jdbc.update(
                    "INSERT INTO techverse.author_profiles(user_id,bio,expertise,status) VALUES"
                            + " (?,'Bio','Java','APPROVED')",
                    id);
        return id;
    }

    private String login(String email) throws Exception {
        var r =
                mvc.perform(
                                post("/api/v1/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                mapper.writeValueAsString(
                                                        Map.of(
                                                                "email",
                                                                email,
                                                                "password",
                                                                "SecurePass123!"))))
                        .andExpect(status().isOk())
                        .andReturn();
        return mapper.readTree(r.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }

    private UUID article(String action, String title) throws Exception {
        var r =
                mvc.perform(
                                post(AUTHOR)
                                        .header("Authorization", bearer(authorToken))
                                        .header("Idempotency-Key", UUID.randomUUID().toString())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                mapper.writeValueAsString(
                                                        Map.of(
                                                                "action",
                                                                action,
                                                                "title",
                                                                title,
                                                                "topicId",
                                                                topic,
                                                                "tagIds",
                                                                List.of(tag),
                                                                "summary",
                                                                "Summary",
                                                                "content",
                                                                "# Java\n"
                                                                        + "```java\n"
                                                                        + "int i = 1;\n"
                                                                        + "```"))))
                        .andExpect(status().isCreated())
                        .andReturn();
        return UUID.fromString(
                mapper.readTree(r.getResponse().getContentAsString()).at("/data/id").asText());
    }

    private ResultActions list(String token) throws Exception {
        return mvc.perform(get(ROOT).header("Authorization", bearer(token)));
    }

    private ResultActions detail(String token, UUID id) throws Exception {
        return mvc.perform(get(ROOT + "/" + id).header("Authorization", bearer(token)));
    }

    private String snapshot(UUID id) throws Exception {
        var r = detail(modToken, id).andExpect(status().isOk()).andReturn();
        String value =
                mapper.readTree(r.getResponse().getContentAsString())
                        .at("/data/reviewToken")
                        .asText();
        assertThat(value).matches("[a-f0-9]{64}");
        return value;
    }

    private ResultActions review(
            String token, UUID id, String decision, String snapshot, String note) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("decision", decision);
        body.put("reviewToken", snapshot);
        body.put("moderationNote", note);
        return mvc.perform(
                patch(ROOT + "/" + id + "/review")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)));
    }

    private String state(UUID id) {
        return jdbc.queryForObject(
                "SELECT status FROM techverse.articles WHERE id=?", String.class, id);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
