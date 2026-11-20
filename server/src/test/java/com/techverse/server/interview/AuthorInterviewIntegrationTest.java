package com.techverse.server.interview;

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

class AuthorInterviewIntegrationTest extends ArticleIntegrationTestBase {
    static final String ROOT = "/api/v1/author/interview-questions";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired StringRedisTemplate redisTemplate;
    // Same override set as the other integration classes so every one shares a Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;

    UUID author, topic;
    String token, otherToken, learnerToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        author = user("author@example.com", true);
        user("other@example.com", true);
        user("learner@example.com", false);
        token = login("author@example.com");
        otherToken = login("other@example.com");
        learnerToken = login("learner@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        redisTemplate.delete(redisTemplate.keys("interview:rate:*"));
    }

    Map<String, Object> body() {
        return Map.of("topicId", topic, "level", "MEDIUM", "question", "  What is the JVM?  ",
                "sampleAnswer", "A virtual machine that runs **bytecode**.", "hint", "Think of bytecode");
    }

    String create() throws Exception {
        return data(send(post(ROOT), token, body()).andExpect(status().isCreated())).path("id").asText();
    }

    String state(String id) throws Exception {
        return data(get(ROOT + "/" + id, token)).path("status").asText();
    }

    ResultActions act(String id, String action) throws Exception {
        return send(post(ROOT + "/" + id + "/" + action), token, Map.of());
    }

    ResultActions visibility(String id, String action) throws Exception {
        return send(patch(ROOT + "/" + id + "/visibility"), token, Map.of("action", action));
    }

    void forcePublished(String id) {
        jdbc.update("UPDATE techverse.interview_questions SET status='PUBLISHED', published_at=now() WHERE id=?::uuid", id);
    }

    @Test
    void createEditSubmitWithdrawAndSubmitAgain() throws Exception {
        var created = data(send(post(ROOT), token, body()).andExpect(status().isCreated()));
        String id = created.path("id").asText();
        assertThat(created.path("status").asText()).isEqualTo("DRAFT");
        assertThat(created.path("question").asText()).isEqualTo("What is the JVM?");
        assertThat(created.path("version").asInt()).isZero();
        assertThat(created.path("aiAssisted").asBoolean()).isFalse();
        assertThat(created.path("topic").path("id").asText()).isEqualTo(topic.toString());

        var edited = data(send(patch(ROOT + "/" + id), token, Map.of("version", 0, "level", "HARD", "hint", "")).andExpect(status().isOk()));
        assertThat(edited.path("version").asInt()).isEqualTo(1);
        assertThat(edited.path("level").asText()).isEqualTo("HARD");
        assertThat(edited.path("hint").isNull()).isTrue();
        assertThat(jdbc.queryForObject("SELECT hint FROM techverse.interview_questions WHERE id=?::uuid", String.class, id)).isNull();
        // Stale version: nothing written.
        send(patch(ROOT + "/" + id), token, Map.of("version", 0, "level", "EASY")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_VERSION_CONFLICT"));

        act(id, "submit").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PENDING"));
        send(patch(ROOT + "/" + id), token, Map.of("version", 2, "level", "EASY")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_NOT_EDITABLE"));
        send(delete(ROOT + "/" + id), token, null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_NOT_DELETABLE"));
        act(id, "submit").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_STATE_INVALID"));
        act(id, "withdraw").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DRAFT"));
        act(id, "withdraw").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_STATE_INVALID"));
        act(id, "submit").andExpect(status().isOk());
        assertThat(data(get(ROOT + "/" + id, token)).path("sampleAnswer").asText()).contains("bytecode");
    }

    @Test
    void contentAndNulAreRejectedBeforeAnyWrite() throws Exception {
        var html = new HashMap<>(body());
        html.put("sampleAnswer", "<script>alert(1)</script> and more text");
        send(post(ROOT), token, html).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INTERVIEW_CONTENT_INVALID"));
        String id = create();
        send(patch(ROOT + "/" + id), token, Map.of("version", 0, "hint", "![x](https://e.com/a.png)")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_CONTENT_INVALID"));
        send(patch(ROOT + "/" + id), token, Map.of("version", 0, "question", "What is \u0000 here?")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_CONTENT_INVALID"));
        assertThat(data(get(ROOT + "/" + id, token)).path("version").asInt()).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.interview_questions", Integer.class)).isEqualTo(1);
    }

    @Test
    void onlyTheOwningApprovedAuthorMayActAndTokensAreChecked() throws Exception {
        String id = create();
        send(post(ROOT), learnerToken, body()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(ROOT, learnerToken).andExpect(status().isForbidden());
        get(ROOT + "/" + id, otherToken).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INTERVIEW_QUESTION_NOT_FOUND"));
        send(patch(ROOT + "/" + id), otherToken, Map.of("version", 0, "level", "EASY")).andExpect(status().isNotFound());
        send(delete(ROOT + "/" + id), otherToken, null).andExpect(status().isNotFound());
        send(post(ROOT + "/" + id + "/copy"), otherToken, Map.of()).andExpect(status().isNotFound());
        get(ROOT + "/" + UUID.randomUUID(), token).andExpect(status().isNotFound());
        get(ROOT + "/" + id, null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        get(ROOT + "/" + id, "not.a.jwt").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_INVALID_ACCESS_TOKEN"));
        assertThat(data(get(ROOT, otherToken)).path("content")).isEmpty();
        assertThat(data(get(ROOT, token)).path("content")).hasSize(1);
    }

    @Test
    void suspendedAuthorsReadDeleteWithdrawAndHideButCannotWriteAndLockedAccountsAreOut() throws Exception {
        String draft = create();
        String pending = create();
        act(pending, "submit").andExpect(status().isOk());
        String published = create();
        forcePublished(published);
        String hidden = create();
        jdbc.update("UPDATE techverse.interview_questions SET status='AUTHOR_HIDDEN', published_at=now() WHERE id=?::uuid", hidden);
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);

        get(ROOT + "/" + draft, token).andExpect(status().isOk());
        get(ROOT, token).andExpect(status().isOk());
        send(post(ROOT), token, body()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        send(patch(ROOT + "/" + draft), token, Map.of("version", 0, "level", "EASY")).andExpect(status().isForbidden());
        act(draft, "submit").andExpect(status().isForbidden());
        act(published, "copy").andExpect(status().isForbidden());
        visibility(hidden, "UNHIDE").andExpect(status().isForbidden());
        get(ROOT + "/options", token).andExpect(status().isForbidden());

        act(pending, "withdraw").andExpect(status().isOk());
        visibility(published, "HIDE").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("AUTHOR_HIDDEN"));
        send(delete(ROOT + "/" + draft), token, null).andExpect(status().isOk());
        get(ROOT + "/" + draft, token).andExpect(status().isNotFound());

        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", author);
        get(ROOT + "/" + pending, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        send(delete(ROOT + "/" + pending), token, null).andExpect(status().isForbidden());
    }

    @Test
    void copyHideUnhideAndDeleteRules() throws Exception {
        String id = create();
        visibility(id, "HIDE").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_STATE_INVALID"));
        forcePublished(id);
        jdbc.update("UPDATE techverse.interview_questions SET ai_assisted=true WHERE id=?::uuid", id);
        send(delete(ROOT + "/" + id), token, null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_NOT_DELETABLE"));
        send(patch(ROOT + "/" + id), token, Map.of("version", 0, "level", "EASY")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_NOT_EDITABLE"));

        var copy = data(act(id, "copy").andExpect(status().isCreated()));
        assertThat(copy.path("id").asText()).isNotEqualTo(id);
        assertThat(copy.path("status").asText()).isEqualTo("DRAFT");
        assertThat(copy.path("aiAssisted").asBoolean()).isTrue();
        assertThat(copy.path("question").asText()).isEqualTo("What is the JVM?");
        assertThat(copy.path("hint").asText()).isEqualTo("Think of bytecode");
        assertThat(copy.path("publishedAt").isNull()).isTrue();

        visibility(id, "HIDE").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("AUTHOR_HIDDEN"));
        visibility(id, "HIDE").andExpect(status().isConflict());
        visibility(id, "UNHIDE").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PUBLISHED"));
        jdbc.update("UPDATE techverse.interview_questions SET status='HIDDEN', hidden_from_status='PUBLISHED' WHERE id=?::uuid", id);
        visibility(id, "UNHIDE").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_STATE_INVALID"));
        // Once published and back to DRAFT (not reachable via API, but guarded): still not deletable.
        jdbc.update("UPDATE techverse.interview_questions SET status='DRAFT', hidden_from_status=NULL WHERE id=?::uuid", id);
        send(delete(ROOT + "/" + id), token, null).andExpect(status().isConflict());
        send(delete(ROOT + "/" + copy.path("id").asText()), token, null).andExpect(status().isOk());
    }

    @Test
    void inactiveTopicBlocksCreateSaveSubmitAndCopy() throws Exception {
        String id = create();
        String published = create();
        forcePublished(published);
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        send(post(ROOT), token, body()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_TOPIC_INACTIVE"));
        send(patch(ROOT + "/" + id), token, Map.of("version", 0, "level", "EASY")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_TOPIC_INACTIVE"));
        act(id, "submit").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_TOPIC_INACTIVE"));
        act(published, "copy").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_TOPIC_INACTIVE"));
        assertThat(state(id)).isEqualTo("DRAFT");
        assertThat(data(get(ROOT + "/options", token))).isEmpty();
        var unknown = new HashMap<>(body());
        unknown.put("topicId", UUID.randomUUID());
        send(post(ROOT), token, unknown).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void twoParallelSubmitsLetExactlyOneWin() throws Exception {
        String id = create();
        var pool = Executors.newFixedThreadPool(2);
        try {
            var latch = new CountDownLatch(1);
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++)
                results.add(pool.submit(() -> {
                    latch.await();
                    return act(id, "submit").andReturn().getResponse().getStatus();
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
    void createsAndCopiesAreLimitedToTwentyPerMinuteAndListFilters() throws Exception {
        String id = create();
        for (int i = 0; i < 19; i++) send(post(ROOT), token, body()).andExpect(status().isCreated());
        send(post(ROOT), token, body()).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("INTERVIEW_RATE_LIMITED"));
        act(id, "copy").andExpect(status().isTooManyRequests());

        jdbc.update("UPDATE techverse.interview_questions SET level='EASY', question='Explain Kafka partitions' WHERE id=?::uuid", id);
        assertThat(data(get(ROOT + "?level=EASY", token)).path("content")).hasSize(1);
        assertThat(data(get(ROOT + "?keyword=KAFKA", token)).path("content")).hasSize(1);
        assertThat(data(get(ROOT + "?keyword=100%25", token)).path("content")).isEmpty();
        assertThat(data(get(ROOT + "?status=PENDING", token)).path("content")).isEmpty();
        assertThat(data(get(ROOT + "?topicId=" + topic + "&size=5&page=1", token)).path("content")).hasSize(5);
        assertThat(data(get(ROOT + "?topicId=" + UUID.randomUUID(), token)).path("content")).isEmpty();
        // List rows carry the content (author view) and the total.
        assertThat(data(get(ROOT + "?size=5", token)).path("totalElements").asInt()).isEqualTo(20);
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
