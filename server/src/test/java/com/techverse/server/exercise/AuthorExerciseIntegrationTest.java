package com.techverse.server.exercise;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.article.ArticleIntegrationTestBase;
import com.techverse.server.entity.User;
import com.techverse.server.repository.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.IntStream;

class AuthorExerciseIntegrationTest extends ArticleIntegrationTestBase {
    static final String ROOT = "/api/v1/author/exercise-sets";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired StringRedisTemplate redisTemplate;
    // Same override set as the course integration classes so every one shares a Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;

    UUID author, other, topic;
    String token, otherToken, learnerToken, modToken, adminToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        author = user("author@example.com", true);
        other = user("other@example.com", true);
        user("learner@example.com", false);
        token = login("author@example.com");
        otherToken = login("other@example.com");
        learnerToken = login("learner@example.com");
        staff("mod@example.com", "MODERATOR");
        staff("admin@example.com", "ADMIN");
        modToken = login("mod@example.com");
        adminToken = login("admin@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        redisTemplate.delete(redisTemplate.keys("exercise:rate:*"));
    }

    // ------------------------------------------------------------------ helpers

    Map<String, Object> newSet() {
        return Map.of("title", "Java basics", "description", "Intro", "topicId", topic, "type", "MULTIPLE_CHOICE", "difficulty", "EASY");
    }

    String create() throws Exception {
        return data(send(post(ROOT), token, newSet()).andExpect(status().isCreated())).path("id").asText();
    }

    static Map<String, Object> mcQuestion(String content) {
        return Map.of("content", content, "options", List.of("a", "b", "c"), "correctIndex", 1, "explanation", "Because b.");
    }

    List<Map<String, Object>> questions(int n) {
        return IntStream.range(0, n).mapToObj(i -> mcQuestion("Question " + i)).toList();
    }

    int version(String id) throws Exception {
        return data(get(ROOT + "/" + id, token)).path("version").asInt();
    }

    ResultActions save(String id, List<Map<String, Object>> list, int version) throws Exception {
        return send(put(ROOT + "/" + id + "/questions"), token, Map.of("version", version, "questions", list));
    }

    String ready() throws Exception {
        String id = create();
        save(id, questions(3), 0).andExpect(status().isOk());
        return id;
    }

    String state(String id) throws Exception {
        return data(get(ROOT + "/" + id, token)).path("status").asText();
    }

    void forcePublished(String id) {
        jdbc.update("UPDATE techverse.exercise_sets SET status='PUBLISHED', published_at=now() WHERE id=?::uuid", id);
    }

    // ------------------------------------------------------------------ tests

    @Test
    void draftToPendingWithdrawAndSubmitAgain() throws Exception {
        String id = create();
        assertThat(state(id)).isEqualTo("DRAFT");
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_NOT_READY"));
        var saved = data(save(id, questions(3), 0).andExpect(status().isOk()));
        assertThat(saved.path("version").asInt()).isEqualTo(1);
        assertThat(saved.path("questions")).hasSize(3);
        assertThat(saved.path("questions").get(0).path("correctIndex").asInt()).isEqualTo(1);
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PENDING"));
        // Pending sets are locked for editing and cannot be deleted.
        save(id, questions(3), 2).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_NOT_EDITABLE"));
        send(delete(ROOT + "/" + id), token, null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_NOT_DELETABLE"));
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_STATE_INVALID"));
        send(post(ROOT + "/" + id + "/withdraw"), token, Map.of()).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DRAFT"));
        send(post(ROOT + "/" + id + "/withdraw"), token, Map.of()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_STATE_INVALID"));
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isOk());
    }

    @Test
    void invalidQuestionsReportFieldErrorsAndWriteNothing() throws Exception {
        String id = create();
        save(id, List.of(mcQuestion("ok"), Map.of("content", "", "options", List.of("a"), "correctIndex", 3, "explanation", "e")), 0)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EXERCISE_QUESTIONS_INVALID"))
                .andExpect(jsonPath("$.fieldErrors['questions[1].content']").exists())
                .andExpect(jsonPath("$.fieldErrors['questions[1].options']").exists());
        save(id, List.of(mcQuestion("<script>alert(1)</script>")), 0).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EXERCISE_CONTENT_INVALID"));
        save(id, List.of(mcQuestion("![pic](https://example.com/a.png)")), 0).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EXERCISE_CONTENT_INVALID"));
        assertThat(version(id)).isZero();
    }

    @Test
    void flashcardsStoreBothFacesAndAnEmptyExplanation() throws Exception {
        String id = data(send(post(ROOT), token, Map.of("title", "Cards one", "topicId", topic, "type", "FLASHCARD", "difficulty", "HARD"))).path("id").asText();
        var out = data(save(id, List.of(Map.of("front", "F", "back", "B")), 0).andExpect(status().isOk()));
        assertThat(out.path("questions").get(0).path("back").asText()).isEqualTo("B");
        assertThat(out.path("questions").get(0).path("explanation").asText()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT answer FROM techverse.exercise_questions WHERE exercise_set_id=?::uuid", String.class, id)).isEqualTo("B");
        save(id, List.of(mcQuestion("not a card")), 1).andExpect(status().isBadRequest());
    }

    @Test
    void staleVersionIsRejectedAndKeepsTheEarlierSave() throws Exception {
        String id = create();
        save(id, questions(2), 0).andExpect(status().isOk());
        save(id, questions(4), 0).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_VERSION_CONFLICT"));
        assertThat(data(get(ROOT + "/" + id, token)).path("questions")).hasSize(2);
        send(patch(ROOT + "/" + id), token, Map.of("version", 0, "title", "New title")).andExpect(status().isConflict());
        send(patch(ROOT + "/" + id), token, Map.of("version", 1, "title", "New title")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2)).andExpect(jsonPath("$.data.title").value("New title"));
        // Replacing with the same positions again works (unique position is released first).
        save(id, questions(5), 2).andExpect(status().isOk());
    }

    @Test
    void onlyTheOwningApprovedAuthorMayAct() throws Exception {
        String id = create();
        send(post(ROOT), learnerToken, newSet()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(ROOT, learnerToken).andExpect(status().isForbidden());
        get(ROOT + "/" + id, otherToken).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("EXERCISE_SET_NOT_FOUND"));
        send(delete(ROOT + "/" + id), otherToken, null).andExpect(status().isNotFound());
        send(post(ROOT + "/" + id + "/copy"), otherToken, Map.of()).andExpect(status().isNotFound());
        get(ROOT + "/" + id, null).andExpect(status().isUnauthorized());
        // Others' sets never show in a list.
        assertThat(data(get(ROOT, otherToken)).path("content")).isEmpty();
        assertThat(data(get(ROOT, token)).path("content")).hasSize(1);
    }

    @Test
    void suspendedAuthorsReadAndDeleteButCannotWriteAndLockedAccountsAreOut() throws Exception {
        String id = ready();
        String draft = create();
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        get(ROOT + "/" + id, token).andExpect(status().isOk());
        send(post(ROOT), token, newSet()).andExpect(status().isForbidden());
        save(id, questions(3), 1).andExpect(status().isForbidden());
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isForbidden());
        send(delete(ROOT + "/" + draft), token, null).andExpect(status().isOk());
        get(ROOT + "/" + draft, token).andExpect(status().isNotFound());

        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", author);
        get(ROOT + "/" + id, token).andExpect(status().isForbidden());
    }

    @Test
    void copyMakesANewDraftWithTheSameQuestionsAndTruncatesTheTitle() throws Exception {
        String id = ready();
        forcePublished(id);
        jdbc.update("UPDATE techverse.exercise_sets SET title=?, ai_assisted=true WHERE id=?::uuid", "T".repeat(255), id);
        var copy = data(send(post(ROOT + "/" + id + "/copy"), token, Map.of()).andExpect(status().isCreated()));
        assertThat(copy.path("status").asText()).isEqualTo("DRAFT");
        assertThat(copy.path("title").asText()).hasSize(255).endsWith(" (bản sao)");
        assertThat(copy.path("aiAssisted").asBoolean()).isTrue();
        assertThat(copy.path("questions")).hasSize(3);
        assertThat(copy.path("id").asText()).isNotEqualTo(id);
    }

    @Test
    void hideAndUnhideOnlyForAuthorOwnedVisibility() throws Exception {
        String id = ready();
        send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", "HIDE")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_STATE_INVALID"));
        forcePublished(id);
        send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", "HIDE")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("AUTHOR_HIDDEN"));
        send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", "UNHIDE")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
        send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", "UNHIDE")).andExpect(status().isConflict());
        jdbc.update("UPDATE techverse.exercise_sets SET status='HIDDEN', hidden_from_status='PUBLISHED' WHERE id=?::uuid", id);
        send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", "UNHIDE")).andExpect(status().isConflict());
    }

    @Test
    void deleteRemovesDraftsWithQuestionsButNotPublishedOnes() throws Exception {
        String id = ready();
        send(delete(ROOT + "/" + id), token, null).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.exercise_questions", Integer.class)).isZero();
        String published = ready();
        forcePublished(published);
        send(delete(ROOT + "/" + published), token, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_NOT_DELETABLE"));
        // The attempt-protecting trigger surfaces as the same business error, never a 500.
        String withAttempt = ready();
        jdbc.update("INSERT INTO techverse.exercise_attempts(user_id, exercise_set_id, attempt_snapshot, idempotency_key)"
                + " VALUES (?, ?::uuid, '{}'::jsonb, ?)", other, withAttempt, UUID.randomUUID());
        send(delete(ROOT + "/" + withAttempt), token, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_NOT_DELETABLE"));
    }

    @Test
    void inactiveTopicBlocksCreateAndSubmit() throws Exception {
        String id = ready();
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        send(post(ROOT), token, newSet()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_TOPIC_INACTIVE"));
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_NOT_READY"));
        send(post(ROOT), token, Map.of("title", "Java basics", "topicId", UUID.randomUUID(), "type", "MULTIPLE_CHOICE", "difficulty", "EASY"))
                .andExpect(status().isBadRequest());
        assertThat(data(get(ROOT + "/options", token))).isEmpty();
    }

    @Test
    void savesRecheckTheKeptTopicAndRejectNulCharacters() throws Exception {
        String id = ready();
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        send(patch(ROOT + "/" + id), token, Map.of("version", 1, "title", "Another title")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_TOPIC_INACTIVE"));
        save(id, questions(3), 1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_TOPIC_INACTIVE"));
        jdbc.update("UPDATE techverse.topics SET is_active=true WHERE id=?", topic);
        save(id, List.of(Map.of("content", "q", "codeSnippet", "a b", "codeLanguage", "java", "options", List.of("a", "b"),
                "correctIndex", 0, "explanation", "e")), 1).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EXERCISE_CONTENT_INVALID"));
        save(id, List.of(Map.of("content", "q", "options", List.of("a ", "b"), "correctIndex", 0, "explanation", "e")), 1)
                .andExpect(status().isBadRequest());
        send(patch(ROOT + "/" + id), token, Map.of("version", 1, "description", "x y")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        assertThat(version(id)).isEqualTo(1);
    }

    @Test
    void twoParallelSubmitsLetExactlyOneWin() throws Exception {
        String id = ready();
        var pool = Executors.newFixedThreadPool(2);
        try {
            var latch = new CountDownLatch(1);
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++)
                results.add(pool.submit(() -> {
                    latch.await();
                    return send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andReturn().getResponse().getStatus();
                }));
            latch.countDown();
            var codes = new ArrayList<Integer>();
            for (var f : results) codes.add(f.get(30, TimeUnit.SECONDS));
            assertThat(codes).containsExactlyInAnyOrder(200, 409);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void createsAndCopiesAreLimitedToTenPerMinute() throws Exception {
        String id = create();
        for (int i = 0; i < 9; i++) send(post(ROOT), token, newSet()).andExpect(status().isCreated());
        send(post(ROOT), token, newSet()).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("EXERCISE_RATE_LIMITED"));
        send(post(ROOT + "/" + id + "/copy"), token, Map.of()).andExpect(status().isTooManyRequests());
    }

    @Test
    void listFiltersAndPages() throws Exception {
        create();
        String cards = data(send(post(ROOT), token, Map.of("title", "Cards one", "topicId", topic, "type", "FLASHCARD", "difficulty", "EASY"))).path("id").asText();
        assertThat(data(get(ROOT + "?type=FLASHCARD", token)).path("content")).hasSize(1);
        assertThat(data(get(ROOT + "?keyword=JAVA", token)).path("content")).hasSize(1);
        assertThat(data(get(ROOT + "?status=PENDING", token)).path("content")).isEmpty();
        var page = data(get(ROOT + "?size=1&page=1", token));
        assertThat(page.path("totalElements").asInt()).isEqualTo(2);
        assertThat(page.path("content")).hasSize(1);
        assertThat(data(get(ROOT + "?size=50", token)).path("content").get(0).path("questionCount").asInt()).isZero();
        assertThat(cards).isNotBlank();
    }

    // ------------------------------------------------------------------ moderator (task 1b)

    static final String MOD = "/api/v1/moderator/exercise-sets";
    static final String PUB = "/api/v1/exercise-sets";

    String reviewToken(String id) throws Exception {
        return data(get(MOD + "/" + id, modToken)).path("reviewToken").asText();
    }

    ResultActions review(String id, String decision, String note, String reviewToken) throws Exception {
        var body = new HashMap<String, Object>(Map.of("decision", decision, "reviewToken", reviewToken));
        if (note != null) body.put("note", note);
        return send(patch(MOD + "/" + id + "/review"), modToken, body);
    }

    ResultActions publication(String id, String action, String reason) throws Exception {
        var body = new HashMap<String, Object>(Map.of("action", action, "reviewToken", reviewToken(id)));
        if (reason != null) body.put("reason", reason);
        return send(patch(MOD + "/" + id + "/publication"), modToken, body);
    }

    String pending() throws Exception {
        String id = ready();
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isOk());
        return id;
    }

    String published() throws Exception {
        String id = pending();
        review(id, "APPROVE", null, reviewToken(id)).andExpect(status().isOk()).andExpect(jsonPath("$.data.set.status").value("PUBLISHED"));
        return id;
    }

    @Test
    void moderatorApprovesOrRequestsChangesWithAFreshTokenOnly() throws Exception {
        String id = pending();
        assertThat(data(get(MOD, modToken)).path("content")).hasSize(1);
        assertThat(data(get(MOD, modToken)).path("content").get(0).path("authorEligible").asBoolean()).isTrue();
        String t1 = reviewToken(id);
        review(id, "APPROVE", null, "0".repeat(64)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_REVIEW_STALE"));
        review(id, "REQUEST_CHANGES", "a b", t1).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        review(id, "REQUEST_CHANGES", " ", t1).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        review(id, "REQUEST_CHANGES", "Fix Q1", t1).andExpect(status().isOk()).andExpect(jsonPath("$.data.set.status").value("CHANGES_REQUESTED"));
        // The old token is stale even though the set is no longer pending: staleness wins over state.
        review(id, "APPROVE", null, t1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_REVIEW_STALE"));
        review(id, "APPROVE", null, reviewToken(id)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_STATE_INVALID"));
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isOk());
        review(id, "APPROVE", "Good", reviewToken(id)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT published_at IS NOT NULL FROM techverse.exercise_sets WHERE id=?::uuid", Boolean.class, id)).isTrue();
        // Staff without the MODERATOR role, learners and guests cannot reach the API; drafts do not exist for moderators.
        get(MOD, adminToken).andExpect(status().isForbidden());
        get(MOD, learnerToken).andExpect(status().isForbidden());
        get(MOD, null).andExpect(status().isUnauthorized());
        String draft = create();
        get(MOD + "/" + draft, modToken).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("EXERCISE_SET_NOT_FOUND"));
        review(draft, "APPROVE", null, "0".repeat(64)).andExpect(status().isNotFound());
        assertThat(data(get(MOD + "?status=DRAFT", modToken)).path("content")).isEmpty();
    }

    @Test
    void approvalRechecksAuthorTopicAndReadiness() throws Exception {
        String a = pending(), b = pending(), c = pending();
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        review(a, "APPROVE", null, reviewToken(a)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_AUTHOR_INELIGIBLE"));
        assertThat(data(get(MOD, modToken)).path("content").get(0).path("authorEligible").asBoolean()).isFalse();
        jdbc.update("UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?", author);
        jdbc.update("UPDATE techverse.exercise_questions SET position=position+10 WHERE exercise_set_id=?::uuid", b);
        jdbc.update("DELETE FROM techverse.exercise_questions WHERE exercise_set_id=?::uuid AND position>11", b);
        review(b, "APPROVE", null, reviewToken(b)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_NOT_READY"));
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        review(c, "APPROVE", null, reviewToken(c)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_TOPIC_INACTIVE"));
        review(c, "REQUEST_CHANGES", "Topic is gone", reviewToken(c)).andExpect(status().isOk());
    }

    @Test
    void hideRestoreAndRemoveReturnToTheRememberedState() throws Exception {
        String id = published();
        publication(id, "HIDE", null).andExpect(status().isBadRequest());
        publication(id, "UNHIDE", "x").andExpect(status().isBadRequest());
        publication(id, "RESTORE", null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_STATE_INVALID"));
        publication(id, "HIDE", "Spam").andExpect(status().isOk()).andExpect(jsonPath("$.data.set.status").value("HIDDEN"));
        send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", "UNHIDE")).andExpect(status().isConflict());
        publication(id, "RESTORE", null).andExpect(status().isOk()).andExpect(jsonPath("$.data.set.status").value("PUBLISHED"));
        send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", "HIDE")).andExpect(status().isOk());
        publication(id, "HIDE", "Spam").andExpect(status().isOk());
        publication(id, "RESTORE", "ok").andExpect(status().isOk()).andExpect(jsonPath("$.data.set.status").value("AUTHOR_HIDDEN"));
        publication(id, "REMOVE", "Illegal").andExpect(status().isOk()).andExpect(jsonPath("$.data.set.status").value("REMOVED"));
        publication(id, "HIDE", "again").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_STATE_INVALID"));
        publication(id, "REMOVE", "again").andExpect(status().isConflict());
        assertThat(data(get(ROOT + "/" + id, token)).path("moderationNote").asText()).isEqualTo("Illegal");
    }

    @Test
    void twoModeratorsApprovingTogetherLeaveOneWinner() throws Exception {
        String id = pending();
        String t = reviewToken(id);
        var pool = Executors.newFixedThreadPool(2);
        var go = new CountDownLatch(1);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < 2; i++)
            results.add(pool.submit(() -> {
                go.await();
                return review(id, "APPROVE", null, t).andReturn().getResponse().getStatus();
            }));
        go.countDown();
        var codes = new ArrayList<Integer>();
        for (var f : results) codes.add(f.get(30, TimeUnit.SECONDS));
        pool.shutdown();
        assertThat(codes).containsExactlyInAnyOrder(200, 409);
    }

    // ------------------------------------------------------------------ practice (task 1b)

    ResultActions submit(String id, String learner, String key, Map<String, ?> body) throws Exception {
        var request = post(PUB + "/" + id + "/attempts");
        if (key != null) request.header("Idempotency-Key", key);
        return send(request, learner, body);
    }

    /** Answers question 0 correctly (index 1), question 1 wrong, question 2 left blank. */
    Map<String, Object> quizAnswers(String id, String learner) throws Exception {
        var qs = data(get(PUB + "/" + id + "/questions", learner)).path("questions");
        return Map.of("answers", List.of(Map.of("questionId", qs.get(0).path("id").asText(), "selectedIndex", 1),
                Map.of("questionId", qs.get(1).path("id").asText(), "selectedIndex", 0)), "durationSeconds", 42);
    }

    @Test
    void guestsBrowseButQuestionsNeedLoginAndNeverShowAnswers() throws Exception {
        String id = published();
        assertThat(data(get(PUB, null)).path("content")).hasSize(1);
        assertThat(data(get(PUB + "?type=FLASHCARD", null)).path("content")).isEmpty();
        assertThat(data(get(PUB + "/options", null))).hasSize(1);
        var intro = data(get(PUB + "/" + id, null));
        assertThat(intro.path("questionCount").asInt()).isEqualTo(3);
        assertThat(intro.path("viewer").path("reason").asText()).isEqualTo("LOGIN_REQUIRED");
        assertThat(intro.has("questions")).isFalse();
        get(PUB + "/" + id + "/questions", null).andExpect(status().isUnauthorized());
        var body = get(PUB + "/" + id + "/questions", learnerToken).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("correctIndex", "explanation", "Because b");
        assertThat(data(get(PUB + "/" + id, learnerToken)).path("viewer").path("canAttempt").asBoolean()).isTrue();
        // Owner, moderator, admin: no attempts.
        for (String t : List.of(token, modToken, adminToken)) {
            get(PUB + "/" + id + "/questions", t).andExpect(status().isForbidden());
            submit(id, t, UUID.randomUUID().toString(), Map.of()).andExpect(status().isForbidden());
        }
        // Unpublished sets do not exist for readers.
        get(PUB + "/" + create(), learnerToken).andExpect(status().isNotFound());
        get(PUB + "/" + UUID.randomUUID() + "/questions", learnerToken).andExpect(status().isNotFound());
    }

    @Test
    void quizIsGradedByTheServerAndRetriesReturnTheStoredAttempt() throws Exception {
        String id = published();
        var answers = quizAnswers(id, learnerToken);
        submit(id, learnerToken, null, answers).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        submit(id, learnerToken, "not-a-uuid", answers).andExpect(status().isBadRequest());
        String key = UUID.randomUUID().toString();
        var first = data(submit(id, learnerToken, key, answers).andExpect(status().isOk()));
        assertThat(first.path("correctCount").asInt()).isEqualTo(1);
        assertThat(first.path("totalCount").asInt()).isEqualTo(3);
        assertThat(first.path("percent").asInt()).isEqualTo(33);
        assertThat(first.path("items").get(0).path("correctIndex").asInt()).isEqualTo(1);
        assertThat(first.path("items").get(0).path("explanation").asText()).isEqualTo("Because b.");
        assertThat(data(submit(id, learnerToken, key, answers)).path("id").asText()).isEqualTo(first.path("id").asText());
        // Same key for another set is refused; a wrong body is refused without storing anything.
        String other = published();
        submit(other, learnerToken, key, answers).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_ATTEMPT_KEY_CONFLICT"));
        submit(id, learnerToken, UUID.randomUUID().toString(), Map.of("answers", List.of(Map.of("questionId", UUID.randomUUID().toString(), "selectedIndex", 0))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EXERCISE_ATTEMPT_INVALID"));
        submit(id, learnerToken, UUID.randomUUID().toString(), Map.of("results", List.of())).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.exercise_attempts", Integer.class)).isEqualTo(1);
        // Hidden mid-attempt: a new key gets 404, the old key still replays the result.
        jdbc.update("UPDATE techverse.exercise_sets SET status='HIDDEN', hidden_from_status='PUBLISHED' WHERE id=?::uuid", id);
        submit(id, learnerToken, UUID.randomUUID().toString(), answers).andExpect(status().isNotFound());
        assertThat(data(submit(id, learnerToken, key, answers)).path("id").asText()).isEqualTo(first.path("id").asText());
    }

    @Test
    void parallelSubmitsWithOneKeyStoreOneAttempt() throws Exception {
        String id = published();
        var answers = quizAnswers(id, learnerToken);
        String key = UUID.randomUUID().toString();
        var pool = Executors.newFixedThreadPool(4);
        var go = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();
        for (int i = 0; i < 4; i++)
            results.add(pool.submit(() -> {
                go.await();
                return data(submit(id, learnerToken, key, answers).andExpect(status().isOk())).path("id").asText();
            }));
        go.countDown();
        var ids = new HashSet<String>();
        for (var f : results) ids.add(f.get(30, TimeUnit.SECONDS));
        pool.shutdown();
        assertThat(ids).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.exercise_attempts", Integer.class)).isEqualTo(1);
    }

    @Test
    void flashcardsCountRememberedAndHistoryStaysReadableAfterRemoval() throws Exception {
        String id = data(send(post(ROOT), token, Map.of("title", "Cards one", "topicId", topic, "type", "FLASHCARD", "difficulty", "EASY"))).path("id").asText();
        save(id, IntStream.range(0, 5).mapToObj(i -> Map.<String, Object>of("front", "F" + i, "back", "B" + i)).toList(), 0).andExpect(status().isOk());
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isOk());
        review(id, "APPROVE", null, reviewToken(id)).andExpect(status().isOk());
        var cards = data(get(PUB + "/" + id + "/questions", learnerToken)).path("questions");
        assertThat(cards.get(0).path("back").asText()).isEqualTo("B0");
        var results = List.of(Map.of("questionId", cards.get(0).path("id").asText(), "remembered", true),
                Map.of("questionId", cards.get(1).path("id").asText(), "remembered", true));
        var attempt = data(submit(id, learnerToken, UUID.randomUUID().toString(), Map.of("results", results)).andExpect(status().isOk()));
        assertThat(attempt.path("correctCount").asInt()).isEqualTo(2);
        assertThat(attempt.path("percent").asInt()).isEqualTo(40);
        submit(id, learnerToken, UUID.randomUUID().toString(), Map.of("answers", List.of())).andExpect(status().isBadRequest());
        // Last attempt shows up in the list; history is private and survives removal of the set.
        assertThat(data(get(PUB, learnerToken)).path("content").get(0).path("lastAttempt").path("correctCount").asInt()).isEqualTo(2);
        publication(id, "REMOVE", "Gone").andExpect(status().isOk());
        get(PUB + "/" + id, learnerToken).andExpect(status().isNotFound());
        assertThat(data(get("/api/v1/me/exercise-attempts?exerciseSetId=" + id, learnerToken)).path("content")).hasSize(1);
        var detail = data(get("/api/v1/me/exercise-attempts/" + attempt.path("id").asText(), learnerToken));
        assertThat(detail.path("items")).hasSize(5);
        assertThat(detail.path("items").get(0).path("back").asText()).isEqualTo("B0");
        get("/api/v1/me/exercise-attempts/" + attempt.path("id").asText(), otherToken).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EXERCISE_ATTEMPT_NOT_FOUND"));
        assertThat(data(get("/api/v1/me/exercise-attempts", otherToken)).path("content")).isEmpty();
        get("/api/v1/me/exercise-attempts", null).andExpect(status().isUnauthorized());
    }

    @Test
    void suspendedAuthorsSetsLeaveTheListAndSubmitsAreRateLimited() throws Exception {
        String id = published();
        var answers = quizAnswers(id, learnerToken);
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        assertThat(data(get(PUB, null)).path("content")).isEmpty();
        submit(id, learnerToken, UUID.randomUUID().toString(), answers).andExpect(status().isNotFound());
        jdbc.update("UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?", author);
        // The refused submit above already used one of the 20 slots.
        for (int i = 0; i < 19; i++) submit(id, learnerToken, UUID.randomUUID().toString(), answers).andExpect(status().isOk());
        submit(id, learnerToken, UUID.randomUUID().toString(), answers).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("EXERCISE_RATE_LIMITED"));
    }

    // ------------------------------------------------------------------ http

    ResultActions send(MockHttpServletRequestBuilder request, String token, Map<String, ?> body) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        return mvc.perform(request);
    }

    ResultActions get(String path, String token) throws Exception {
        var request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path);
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mvc.perform(request);
    }

    JsonNode data(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    UUID user(String email, boolean authorRole) {
        UUID id = users.saveAndFlush(User.createLocalAccount("User " + email, email, encoder.encode("SecurePass123!"))).getId();
        if (authorRole) {
            jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name='AUTHOR'", id);
            jdbc.update("INSERT INTO techverse.author_profiles(user_id,bio,expertise,status) VALUES (?,'Bio','Java','APPROVED')", id);
        }
        return id;
    }

    void staff(String email, String role) {
        UUID id = users.saveAndFlush(User.createLocalAccount("User " + email, email, encoder.encode("SecurePass123!"))).getId();
        jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name=?", id, role);
    }

    String login(String email) throws Exception {
        var r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "SecurePass123!"))))
                .andExpect(status().isOk()).andReturn();
        return mapper.readTree(r.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }

    // ------------------------------------------------------------------ AI questions (1c)

    static final String AI_QUIZ = "{\"questions\":[{\"content\":\"JWT gồm mấy phần?\",\"codeSnippet\":\"\",\"codeLanguage\":\"\","
            + "\"options\":[\"1\",\"2\",\"3\",\"4\"],\"correctIndex\":2,\"explanation\":\"Header, payload, signature.\"}]}";

    void modelReplies(String json) {
        org.mockito.Mockito.when(chatModel.getDefaultOptions())
                .thenReturn(org.springframework.ai.openai.OpenAiChatOptions.builder().model("m").build());
        org.mockito.Mockito.when(chatModel.call(org.mockito.ArgumentMatchers.any(org.springframework.ai.chat.prompt.Prompt.class)))
                .thenReturn(new org.springframework.ai.chat.model.ChatResponse(List.of(new org.springframework.ai.chat.model.Generation(
                        new org.springframework.ai.chat.messages.AssistantMessage(json),
                        org.springframework.ai.chat.metadata.ChatGenerationMetadata.builder().finishReason("STOP").build()))));
    }

    String aiUrl(String id) {
        return ROOT + "/" + id + "/ai/questions";
    }

    @Test
    void aiQuestionsNeedTheOwnerAnEditableSetAndRoomForMoreQuestions() throws Exception {
        String id = ready();
        send(post(aiUrl(id)), otherToken, Map.of("version", 0, "count", 2)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EXERCISE_SET_NOT_FOUND"));
        send(post(aiUrl(id)), learnerToken, Map.of("version", 0, "count", 2)).andExpect(status().isForbidden());
        send(post(aiUrl(id)), null, Map.of("version", 0, "count", 2)).andExpect(status().isUnauthorized());
        send(post(aiUrl(id)), token, Map.of("version", 0, "count", 0)).andExpect(status().isBadRequest());
        save(id, questions(50), version(id)).andExpect(status().isOk());
        send(post(aiUrl(id)), token, Map.of("version", version(id), "count", 1)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EXERCISE_QUESTIONS_INVALID"));
        send(post(ROOT + "/" + id + "/submit"), token, Map.of()).andExpect(status().isOk());
        send(post(aiUrl(id)), token, Map.of("version", version(id), "count", 1)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_NOT_EDITABLE"));
        org.mockito.Mockito.verify(chatModel, org.mockito.Mockito.never()).call(org.mockito.ArgumentMatchers.any(org.springframework.ai.chat.prompt.Prompt.class));
    }

    @Test
    void aiQuestionsAreProposedWithoutSavingAndFlagTheSet() throws Exception {
        String id = ready();
        int before = version(id);
        modelReplies(AI_QUIZ);
        var res = send(post(aiUrl(id)), token, Map.of("version", before, "count", 2, "instruction", "JWT", "sourceText", "JWT là chuẩn token."))
                .andExpect(status().isOk()).andExpect(header().string("X-AI-Quota-Limit", "10"))
                .andExpect(header().string("X-AI-Quota-Remaining", "9"));
        var body = data(res);
        assertThat(body.path("questions")).hasSize(1);
        assertThat(body.path("requested").asInt()).isEqualTo(2);
        assertThat(body.path("version").asInt()).isEqualTo(before + 1);
        var set = data(get(ROOT + "/" + id, token));
        assertThat(set.path("aiAssisted").asBoolean()).isTrue();
        assertThat(set.path("questions")).hasSize(3);
        assertThat(set.path("version").asInt()).isEqualTo(before + 1);
    }

    @Test
    void aiQuestionsFromAStaleTabAreRejectedAndRefunded() throws Exception {
        String id = ready();
        int stale = version(id);
        save(id, questions(4), stale).andExpect(status().isOk());
        modelReplies(AI_QUIZ);
        send(post(aiUrl(id)), token, Map.of("version", stale, "count", 1)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_VERSION_CONFLICT"));
        org.mockito.Mockito.verify(chatModel, org.mockito.Mockito.never()).call(org.mockito.ArgumentMatchers.any(org.springframework.ai.chat.prompt.Prompt.class));
        assertThat(data(get("/api/v1/author/ai/quota", token)).path("exercise").path("remaining").asInt()).isEqualTo(10);
        assertThat(data(get(ROOT + "/" + id, token)).path("aiAssisted").asBoolean()).isFalse();
    }

    @Test
    void aiQuestionsStopWhenTheDayIsUsedUpAndTheQuotaApiListsExercise() throws Exception {
        String id = ready();
        var quota = data(get("/api/v1/author/ai/quota", token));
        assertThat(quota.path("exercise").path("limit").asInt()).isEqualTo(10);
        assertThat(quota.path("exercise").path("remaining").asInt()).isEqualTo(10);
        assertThat(quota.path("outline").path("limit").asInt()).isPositive();
        assertThat(quota.path("draft").path("limit").asInt()).isPositive();

        String day = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        redisTemplate.opsForValue().set("ai:quota:exercise:" + author + ":" + day, "10");
        send(post(aiUrl(id)), token, Map.of("version", version(id), "count", 1)).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("AI_QUOTA_EXCEEDED"));
        assertThat(data(get("/api/v1/author/ai/quota", token)).path("exercise").path("remaining").asInt()).isZero();
        assertThat(data(get(ROOT + "/" + id, token)).path("aiAssisted").asBoolean()).isFalse();
    }
}
