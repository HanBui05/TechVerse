package com.techverse.server.moderator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.entity.User;
import com.techverse.server.repository.UserRepository;

import com.techverse.server.article.ArticleIntegrationTestBase;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.*;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.concurrent.*;

class ModeratorArticleIntegrationTest extends ArticleIntegrationTestBase {
    static final String ROOT = "/api/v1/moderator/articles";
    static final String AUTHOR = "/api/v1/author/articles";
    static final String CONTENT = "# Java\n```java\nint i = 1;\n```";

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
            history(t, id).andExpect(status().isForbidden());
            review(t, id, "APPROVE", "0".repeat(64), null).andExpect(status().isForbidden());
            publication(t, id, "HIDE", "0".repeat(64), "x").andExpect(status().isForbidden());
        }
        mvc.perform(get(ROOT)).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT + "/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT + "/" + id + "/history")).andExpect(status().isUnauthorized());
        for (String action : List.of("review", "publication"))
            mvc.perform(
                            patch(ROOT + "/" + id + "/" + action)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{} "))
                    .andExpect(status().isUnauthorized());
    }

    @Test
    void revokedModeratorRoleIsNotTrustedFromOldJwt() throws Exception {
        UUID id = article("SUBMIT", "Title");
        String token = token(id);
        jdbc.update(
                "DELETE FROM techverse.user_roles WHERE user_id=? AND role_id=(SELECT id FROM"
                        + " techverse.roles WHERE name='MODERATOR')",
                moderator);
        list(modToken).andExpect(status().isForbidden());
        detail(modToken, id).andExpect(status().isForbidden());
        review(modToken, id, "APPROVE", token, null).andExpect(status().isForbidden());
        assertThat(workflow(id)).isEqualTo("PENDING");
    }

    @Test
    void listExcludesPrivateDraftsAndAuthorDeletedAndFiltersBothAxes() throws Exception {
        UUID pending = article("SUBMIT", "Review me");
        UUID draft = article("SAVE", "Private draft");
        UUID changes = article("SUBMIT", "Needs changes");
        review(modToken, changes, "REQUEST_CHANGES", token(changes), "Add an example")
                .andExpect(status().isOk());
        UUID published = published("Published article");
        UUID hidden = published("Hidden article");
        publication(modToken, hidden, "HIDE", token(hidden), "Policy").andExpect(status().isOk());
        UUID deleted = published("Deleted article");
        mvc.perform(delete(AUTHOR + "/" + deleted).header("Authorization", bearer(authorToken)))
                .andExpect(status().isOk());
        list(modToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(4))
                .andExpect(
                        jsonPath("$.data.content[*].id")
                                .value(
                                        org.hamcrest.Matchers.containsInAnyOrder(
                                                pending.toString(),
                                                changes.toString(),
                                                published.toString(),
                                                hidden.toString())))
                .andExpect(jsonPath("$.data.content[0].author.id").value(author.toString()))
                .andExpect(jsonPath("$.data.content[0].author.email").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].content").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].authorEligible").value(true))
                .andExpect(jsonPath("$.data.content[0].hasUnpublishedChanges").value(false));
        for (var entry :
                Map.of(
                                "workflowStatus=PENDING", pending,
                                "workflowStatus=CHANGES_REQUESTED", changes,
                                "publicationStatus=HIDDEN", hidden)
                        .entrySet()) {
            String[] param = entry.getKey().split("=");
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", bearer(modToken))
                                    .param(param[0], param[1]))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalElements").value(1))
                    .andExpect(jsonPath("$.data.content[0].id").value(entry.getValue().toString()));
        }
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(modToken))
                                .param("publicationStatus", "AUTHOR_DELETED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
        detail(modToken, draft).andExpect(status().isNotFound());
        history(modToken, draft).andExpect(status().isNotFound());
        detail(modToken, UUID.randomUUID()).andExpect(status().isNotFound());
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
                        Map.of("workflowStatus", "APPROVE"),
                        Map.of("publicationStatus", "VISIBLE"),
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
        UUID id = article("SUBMIT", "History");
        mvc.perform(
                        get(ROOT + "/" + id + "/history")
                                .header("Authorization", bearer(modToken))
                                .param("size", "101"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void firstApprovalPublishesVersionOneWithAuditAndReadingTime() throws Exception {
        UUID id = article("SUBMIT", "Markdown code");
        jdbc.update("UPDATE techverse.articles SET ai_assisted=true WHERE id=?", id);
        list(modToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].aiAssisted").value(true));
        detail(modToken, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.aiAssisted").value(true))
                .andExpect(jsonPath("$.data.article.content").value(CONTENT))
                .andExpect(jsonPath("$.data.article.tags[0].id").value(tag.toString()))
                .andExpect(jsonPath("$.data.article.publishedVersion").isEmpty())
                .andExpect(jsonPath("$.data.authorEligible").value(true));
        review(modToken, id, "APPROVE", token(id), " Ready ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.workflowStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.article.publicationStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.article.aiAssisted").value(true))
                .andExpect(jsonPath("$.data.article.reviewedBy").value(moderator.toString()))
                .andExpect(jsonPath("$.data.article.publishedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.article.moderationNote").value("Ready"))
                .andExpect(jsonPath("$.data.article.publishedVersion.versionNumber").value(1))
                .andExpect(jsonPath("$.data.article.publishedVersion.readingMinutes").value(1))
                .andExpect(
                        jsonPath("$.data.article.publishedVersion.approvedBy")
                                .value(moderator.toString()))
                .andExpect(
                        jsonPath("$.data.article.publishedVersion.contentFingerprint")
                                .value(org.hamcrest.Matchers.matchesPattern("[a-f0-9]{64}")))
                .andExpect(jsonPath("$.data.history[0].action").value("APPROVE"))
                .andExpect(jsonPath("$.data.history[0].versionNumber").value(1));
        history(modToken, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].action").value("APPROVE"))
                .andExpect(jsonPath("$.data.content[0].note").value("Ready"))
                .andExpect(jsonPath("$.data.content[0].fromWorkflowStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.content[0].toPublicationStatus").value("PUBLISHED"));
    }

    @Test
    void updateApprovalCreatesNextVersionAndDetailComparesWorkingWithPublic() throws Exception {
        UUID id = published("Original title");
        String firstPublishedAt =
                json(detail(modToken, id)).at("/data/article/publishedAt").asText();
        revise(id, "Revised title");
        detail(modToken, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.title").value("Revised title"))
                .andExpect(jsonPath("$.data.article.workflowStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.article.hasUnpublishedChanges").value(true))
                .andExpect(jsonPath("$.data.article.publishedVersion.title").value("Original title"))
                .andExpect(jsonPath("$.data.article.publishedVersion.versionNumber").value(1));
        review(modToken, id, "REQUEST_CHANGES", token(id), "Explain more")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.workflowStatus").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.data.article.publicationStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.article.publishedVersion.versionNumber").value(1));
        submit(id);
        review(modToken, id, "APPROVE", token(id), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.publishedVersion.versionNumber").value(2))
                .andExpect(jsonPath("$.data.article.publishedVersion.title").value("Revised title"))
                .andExpect(jsonPath("$.data.article.publishedAt").value(firstPublishedAt))
                .andExpect(jsonPath("$.data.article.hasUnpublishedChanges").value(false));
        assertThat(
                        jdbc.queryForList(
                                "SELECT version_number FROM techverse.article_publication_versions"
                                        + " WHERE article_id=? ORDER BY version_number",
                                Integer.class,
                                id))
                .containsExactly(1, 2);
        history(modToken, id)
                .andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.content[0].action").value("APPROVE"))
                .andExpect(jsonPath("$.data.content[0].versionNumber").value(2))
                .andExpect(jsonPath("$.data.content[1].action").value("REQUEST_CHANGES"))
                .andExpect(jsonPath("$.data.content[2].versionNumber").value(1));
    }

    @Test
    void hideRestoreRemoveRecordHistoryAndRestoreTheHiddenSource() throws Exception {
        UUID id = published("Lifecycle");
        publication(modToken, id, "HIDE", token(id), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ARTICLE_PUBLICATION_NOTE_REQUIRED"));
        publication(modToken, id, "HIDE", "0".repeat(64), "Spam")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ARTICLE_REVIEW_STALE"));
        publication(modToken, id, "UNHIDE", token(id), "x").andExpect(status().isBadRequest());
        publication(modToken, id, "RESTORE", token(id), null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ARTICLE_PUBLICATION_TRANSITION_INVALID"));
        assertThat(publicationStatus(id)).isEqualTo("PUBLISHED");

        publication(modToken, id, "HIDE", token(id), " Spam ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.publicationStatus").value("HIDDEN"))
                .andExpect(jsonPath("$.data.reviewToken").isNotEmpty());
        publication(modToken, id, "RESTORE", token(id), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.publicationStatus").value("PUBLISHED"));

        authorPublication(id, "HIDE").andExpect(status().isOk());
        publication(modToken, id, "HIDE", token(id), "Policy").andExpect(status().isOk());
        authorPublication(id, "UNHIDE")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED"));
        publication(modToken, id, "RESTORE", token(id), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.publicationStatus").value("AUTHOR_HIDDEN"));

        publication(modToken, id, "HIDE", token(id), "Again").andExpect(status().isOk());
        publication(modToken, id, "REMOVE", token(id), null).andExpect(status().isBadRequest());
        publication(modToken, id, "REMOVE", token(id), "Illegal content")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.publicationStatus").value("REMOVED"));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT hidden_from_publication_status FROM techverse.articles"
                                        + " WHERE id=?",
                                String.class,
                                id))
                .isNull();
        for (String action : List.of("RESTORE", "HIDE", "REMOVE"))
            publication(modToken, id, action, token(id), "x")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("ARTICLE_PUBLICATION_TRANSITION_INVALID"));
        var actions = new ArrayList<String>();
        json(history(modToken, id)).at("/data/content").forEach(h -> actions.add(h.get("action").asText()));
        assertThat(actions)
                .containsExactly(
                        "REMOVE", "HIDE", "RESTORE", "HIDE", "AUTHOR_HIDE", "RESTORE", "HIDE",
                        "APPROVE");
        assertThat(json(history(modToken, id)).at("/data/content/6/note").asText()).isEqualTo("Spam");
    }

    @Test
    void approvingWhileModeratorHiddenReturnsToTheHiddenSource() throws Exception {
        UUID id = published("Hidden revision");
        authorPublication(id, "HIDE").andExpect(status().isOk());
        revise(id, "Hidden revision v2");
        publication(modToken, id, "HIDE", token(id), "Check").andExpect(status().isOk());
        review(modToken, id, "APPROVE", token(id), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.publicationStatus").value("AUTHOR_HIDDEN"))
                .andExpect(jsonPath("$.data.article.publishedVersion.versionNumber").value(2));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT hidden_from_publication_status FROM techverse.articles"
                                        + " WHERE id=?",
                                String.class,
                                id))
                .isNull();
    }

    @Test
    void authorDeletedArticleIsAuditOnlyForModerators() throws Exception {
        UUID id = published("Deleted");
        revise(id, "Deleted revision");
        String token = token(id);
        mvc.perform(delete(AUTHOR + "/" + id).header("Authorization", bearer(authorToken)))
                .andExpect(status().isOk());
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(modToken))
                                .param("workflowStatus", "PENDING"))
                .andExpect(jsonPath("$.data.totalElements").value(0));
        detail(modToken, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.publicationStatus").value("AUTHOR_DELETED"));
        history(modToken, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].action").value("AUTHOR_DELETE"));
        token = token(id);
        for (String decision : List.of("APPROVE", "REQUEST_CHANGES"))
            review(modToken, id, decision, token, "x")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("ARTICLE_PUBLICATION_TRANSITION_INVALID"));
        for (String action : List.of("HIDE", "RESTORE", "REMOVE"))
            publication(modToken, id, action, token, "x")
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("ARTICLE_PUBLICATION_TRANSITION_INVALID"));
        assertThat(publicationStatus(id)).isEqualTo("AUTHOR_DELETED");
        assertThat(workflow(id)).isEqualTo("PENDING");
    }

    @Test
    void feedbackAndIdenticalResubmissionRejectOldTabToken() throws Exception {
        UUID id = article("SUBMIT", "Unchanged title");
        String old = token(id);
        review(modToken, id, "REQUEST_CHANGES", old, " Add explanation ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.article.workflowStatus").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.data.article.moderationNote").value("Add explanation"))
                .andExpect(jsonPath("$.data.article.publishedAt").isEmpty());
        submit(id);
        review(modToken, id, "APPROVE", old, null).andExpect(status().isConflict());
        assertThat(workflow(id)).isEqualTo("PENDING");
        review(modToken, id, "APPROVE", token(id), null).andExpect(status().isOk());
    }

    @Test
    void onlyPendingArticlesCanBeReviewedAndTokenMustMatch() throws Exception {
        UUID id = article("SUBMIT", "Title");
        review(modToken, id, "APPROVE", "0".repeat(64), null).andExpect(status().isConflict());
        String valid = token(id);
        review(modToken, id, "APPROVE", valid, null).andExpect(status().isOk());
        review(modToken, id, "REQUEST_CHANGES", token(id), "Again")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ARTICLE_NOT_PENDING"));
        UUID draft = article("SAVE", "Draft");
        review(modToken, draft, "APPROVE", valid, null).andExpect(status().isNotFound());
        publication(modToken, draft, "HIDE", valid, "x").andExpect(status().isNotFound());
        review(modToken, UUID.randomUUID(), "APPROVE", valid, null)
                .andExpect(status().isNotFound());
    }

    @Test
    void feedbackDecisionAndTokenValidationDoNotChangeArticle() throws Exception {
        UUID id = article("SUBMIT", "Title");
        String token = token(id);
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
        publication(modToken, id, "HIDE", null, "x").andExpect(status().isBadRequest());
        assertThat(workflow(id)).isEqualTo("PENDING");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM techverse.article_moderation_history",
                                Integer.class))
                .isZero();
    }

    @Test
    void moderatorCannotReviewOwnArticle() throws Exception {
        UUID id = article("SUBMIT", "Self");
        jdbc.update(
                "INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles"
                        + " WHERE name='MODERATOR'",
                author);
        review(login("author@example.com"), id, "APPROVE", token(id), null)
                .andExpect(status().isForbidden());
    }

    @Test
    void inactiveAssociationsPreventApprovalButAllowFeedback() throws Exception {
        for (String table : List.of("topics", "tags")) {
            UUID id = article("SUBMIT", table);
            String token = token(id);
            jdbc.update("UPDATE techverse." + table + " SET is_active=false");
            review(modToken, id, "APPROVE", token, null).andExpect(status().isConflict());
            review(modToken, id, "REQUEST_CHANGES", token, "Please choose active options")
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
            String token = token(id);
            jdbc.update(update, author);
            detail(modToken, id).andExpect(jsonPath("$.data.authorEligible").value(false));
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", bearer(modToken))
                                    .param("keyword", "Eligibility")
                                    .param("workflowStatus", "PENDING"))
                    .andExpect(jsonPath("$.data.content[0].authorEligible").value(false));
            review(modToken, id, "APPROVE", token, null)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("ARTICLE_AUTHOR_INELIGIBLE"));
            review(modToken, id, "REQUEST_CHANGES", token, "Contact support")
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
        String token = token(id);
        jdbc.update(
                "DELETE FROM techverse.user_roles WHERE user_id=? AND role_id=(SELECT id FROM"
                        + " techverse.roles WHERE name='AUTHOR')",
                author);
        review(modToken, id, "APPROVE", token, null).andExpect(status().isConflict());
    }

    @Test
    void twoModeratorsRaceOnlyOneCanChangePendingArticle() throws Exception {
        UUID id = article("SUBMIT", "Concurrent");
        String token = token(id);
        assertThat(race(() -> review(modToken, id, "APPROVE", token, null), () -> review(secondModToken, id, "APPROVE", token, null)))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(workflow(id)).isEqualTo("PUBLISHED");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM techverse.article_publication_versions"
                                        + " WHERE article_id=?",
                                Integer.class,
                                id))
                .isEqualTo(1);
    }

    @Test
    void concurrentHideAndRemoveFromOneTokenHaveOneOutcome() throws Exception {
        UUID id = published("Concurrent publication");
        String token = token(id);
        assertThat(
                        race(
                                () -> publication(modToken, id, "HIDE", token, "Spam"),
                                () -> publication(secondModToken, id, "REMOVE", token, "Spam")))
                .containsExactlyInAnyOrder(200, 409);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM techverse.article_moderation_history"
                                        + " WHERE article_id=?",
                                Integer.class,
                                id))
                .isEqualTo(2);
    }

    private List<Integer> race(Callable<ResultActions> first, Callable<ResultActions> second)
            throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            List<Future<Integer>> outcomes = new ArrayList<>();
            for (Callable<ResultActions> call : List.of(first, second))
                outcomes.add(
                        pool.submit(
                                () -> {
                                    ready.countDown();
                                    assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                                    return call.call().andReturn().getResponse().getStatus();
                                }));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(
                    outcomes.get(0).get(40, TimeUnit.SECONDS),
                    outcomes.get(1).get(40, TimeUnit.SECONDS));
        }
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
                                                                "action", action,
                                                                "title", title,
                                                                "topicId", topic,
                                                                "tagIds", List.of(tag),
                                                                "summary", "Summary",
                                                                "content", CONTENT))))
                        .andExpect(status().isCreated())
                        .andReturn();
        return UUID.fromString(
                mapper.readTree(r.getResponse().getContentAsString()).at("/data/id").asText());
    }

    /** Publishes through the real Author and Moderator APIs. */
    private UUID published(String title) throws Exception {
        UUID id = article("SUBMIT", title);
        review(modToken, id, "APPROVE", token(id), null).andExpect(status().isOk());
        return id;
    }

    /** Starts a revision of a published article and submits it for review. */
    private void revise(UUID id, String title) throws Exception {
        mvc.perform(
                        patch(AUTHOR + "/" + id)
                                .header("Authorization", bearer(authorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        mapper.writeValueAsString(
                                                Map.of("action", "SUBMIT", "title", title))))
                .andExpect(status().isOk());
    }

    private void submit(UUID id) throws Exception {
        mvc.perform(
                        patch(AUTHOR + "/" + id)
                                .header("Authorization", bearer(authorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"action\":\"SUBMIT\",\"summary\":\"Summary " + UUID.randomUUID() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workflowStatus").value("PENDING"));
    }

    private ResultActions authorPublication(UUID id, String action) throws Exception {
        return mvc.perform(
                patch(AUTHOR + "/" + id + "/publication")
                        .header("Authorization", bearer(authorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"" + action + "\"}"));
    }

    private ResultActions list(String token) throws Exception {
        return mvc.perform(get(ROOT).header("Authorization", bearer(token)));
    }

    private ResultActions detail(String token, UUID id) throws Exception {
        return mvc.perform(get(ROOT + "/" + id).header("Authorization", bearer(token)));
    }

    private ResultActions history(String token, UUID id) throws Exception {
        return mvc.perform(get(ROOT + "/" + id + "/history").header("Authorization", bearer(token)));
    }

    private JsonNode json(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private String token(UUID id) throws Exception {
        String value =
                json(detail(modToken, id).andExpect(status().isOk())).at("/data/reviewToken").asText();
        assertThat(value).matches("[a-f0-9]{64}");
        return value;
    }

    private ResultActions review(
            String token, UUID id, String decision, String reviewToken, String note)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("decision", decision);
        body.put("reviewToken", reviewToken);
        body.put("moderationNote", note);
        return mvc.perform(
                patch(ROOT + "/" + id + "/review")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)));
    }

    private ResultActions publication(
            String token, UUID id, String action, String reviewToken, String note)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("action", action);
        body.put("reviewToken", reviewToken);
        body.put("moderationNote", note);
        return mvc.perform(
                patch(ROOT + "/" + id + "/publication")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)));
    }

    private String workflow(UUID id) {
        return jdbc.queryForObject(
                "SELECT workflow_status FROM techverse.articles WHERE id=?", String.class, id);
    }

    private String publicationStatus(UUID id) {
        return jdbc.queryForObject(
                "SELECT publication_status FROM techverse.articles WHERE id=?", String.class, id);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
