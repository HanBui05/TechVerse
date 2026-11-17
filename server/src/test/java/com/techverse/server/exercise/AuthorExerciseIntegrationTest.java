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
    String token, otherToken, learnerToken;

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

    String login(String email) throws Exception {
        var r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "SecurePass123!"))))
                .andExpect(status().isOk()).andReturn();
        return mapper.readTree(r.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
