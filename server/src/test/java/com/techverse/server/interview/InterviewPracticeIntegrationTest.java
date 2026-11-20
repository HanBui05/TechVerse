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

/** Moderator review/publication and the learner side (public pages, answers, marks) with DB and security. */
class InterviewPracticeIntegrationTest extends ArticleIntegrationTestBase {
    static final String AUTHOR = "/api/v1/author/interview-questions";
    static final String MOD = "/api/v1/moderator/interview-questions";
    static final String PUB = "/api/v1/interview-questions";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired StringRedisTemplate redisTemplate;
    // Same override set as the other integration classes so every one shares a Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;

    UUID author, learner, moderator, topic;
    String authorToken, learnerToken, modToken, mod2Token, adminToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        author = user("author@example.com", "AUTHOR");
        learner = user("learner@example.com", null);
        moderator = user("mod@example.com", "MODERATOR");
        user("mod2@example.com", "MODERATOR");
        user("admin@example.com", "ADMIN");
        authorToken = login("author@example.com");
        learnerToken = login("learner@example.com");
        modToken = login("mod@example.com");
        mod2Token = login("mod2@example.com");
        adminToken = login("admin@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        redisTemplate.delete(redisTemplate.keys("interview:rate:*"));
    }

    // ------------------------------------------------------------------ moderator

    @Test
    void moderatorRequestsChangesThenApprovesAndDraftsStayPrivate() throws Exception {
        String id = draft();
        get(MOD + "/" + id, modToken).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INTERVIEW_QUESTION_NOT_FOUND"));
        assertThat(data(get(MOD, modToken)).path("content")).isEmpty();

        send(post(AUTHOR + "/" + id + "/submit"), authorToken, Map.of()).andExpect(status().isOk());
        var row = data(get(MOD, modToken)).path("content").get(0);
        assertThat(row.path("question").path("id").asText()).isEqualTo(id);
        assertThat(row.path("authorEligible").asBoolean()).isTrue();
        assertThat(row.path("question").path("aiAssisted").asBoolean()).isFalse();
        var detail = data(get(MOD + "/" + id, modToken));
        assertThat(detail.path("question").path("sampleAnswer").asText()).contains("bytecode");
        String token = detail.path("reviewToken").asText();

        review(id, modToken, Map.of("decision", "REQUEST_CHANGES", "reviewToken", token)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        review(id, modToken, Map.of("decision", "REQUEST_CHANGES", "reviewToken", token, "note", "  Add an example  "))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.question.status").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.data.question.moderationNote").value("Add an example"));
        send(post(AUTHOR + "/" + id + "/submit"), authorToken, Map.of()).andExpect(status().isOk());

        review(id, modToken, Map.of("decision", "APPROVE", "reviewToken", token)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_REVIEW_STALE"));
        String fresh = data(get(MOD + "/" + id, modToken)).path("reviewToken").asText();
        review(id, modToken, Map.of("decision", "APPROVE", "reviewToken", fresh)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.question.status").value("PUBLISHED"));
        assertThat(jdbc.queryForObject("SELECT reviewed_by FROM techverse.interview_questions WHERE id=?::uuid", UUID.class, id)).isEqualTo(moderator);
        assertThat(jdbc.queryForObject("SELECT published_at IS NOT NULL FROM techverse.interview_questions WHERE id=?::uuid", Boolean.class, id)).isTrue();
        String now = data(get(MOD + "/" + id, modToken)).path("reviewToken").asText();
        review(id, modToken, Map.of("decision", "APPROVE", "reviewToken", now)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_STATE_INVALID"));
        assertThat(data(get(MOD + "?status=PUBLISHED", modToken)).path("content")).hasSize(1);
        assertThat(data(get(MOD + "?status=PUBLISHED&level=EASY", modToken)).path("content")).isEmpty();
        assertThat(data(get(MOD + "?status=PUBLISHED&keyword=jvm", modToken)).path("content")).hasSize(1);
    }

    @Test
    void twoModeratorsReviewingTogetherLetExactlyOneWin() throws Exception {
        String id = pending();
        String token = data(get(MOD + "/" + id, modToken)).path("reviewToken").asText();
        var pool = Executors.newFixedThreadPool(2);
        try {
            var latch = new CountDownLatch(1);
            List<Future<String>> results = new ArrayList<>();
            for (String t : List.of(modToken, mod2Token))
                results.add(pool.submit(() -> {
                    latch.await();
                    var r = review(id, t, Map.of("decision", "APPROVE", "reviewToken", token)).andReturn().getResponse();
                    return r.getStatus() + ":" + mapper.readTree(r.getContentAsString()).path("code").asText();
                }));
            latch.countDown();
            var codes = new ArrayList<String>();
            for (var f : results) codes.add(f.get(30, TimeUnit.SECONDS));
            assertThat(codes).containsExactlyInAnyOrder("200:", "409:INTERVIEW_REVIEW_STALE");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void approvalRechecksAuthorAndTopic() throws Exception {
        String id = pending();
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        var detail = data(get(MOD + "/" + id, modToken));
        assertThat(detail.path("authorEligible").asBoolean()).isFalse();
        review(id, modToken, Map.of("decision", "APPROVE", "reviewToken", detail.path("reviewToken").asText()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_AUTHOR_INELIGIBLE"));
        jdbc.update("UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?", author);
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        review(id, modToken, Map.of("decision", "APPROVE", "reviewToken", detail.path("reviewToken").asText()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_TOPIC_INACTIVE"));
        // Asking for changes does not publish, so it is still allowed.
        review(id, modToken, Map.of("decision", "REQUEST_CHANGES", "note", "Pick an active topic", "reviewToken", detail.path("reviewToken").asText()))
                .andExpect(status().isOk());
    }

    @Test
    void hideRestoresThePreviousStateAndRemoveIsFinal() throws Exception {
        String id = published();
        send(patch(AUTHOR + "/" + id + "/visibility"), authorToken, Map.of("action", "HIDE")).andExpect(status().isOk());
        publication(id, Map.of("action", "HIDE")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        publication(id, Map.of("action", "HIDE", "reason", "Spam")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.question.status").value("HIDDEN"));
        publication(id, Map.of("action", "RESTORE")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.question.status").value("AUTHOR_HIDDEN"));
        publication(id, Map.of("action", "RESTORE")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_STATE_INVALID"));
        publication(id, Map.of("action", "HIDE", "reason", "Spam")).andExpect(status().isOk());
        publication(id, Map.of("action", "REMOVE", "reason", "Copied")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.question.status").value("REMOVED"));
        publication(id, Map.of("action", "HIDE", "reason", "Spam")).andExpect(status().isConflict());
        publication(id, Map.of("action", "RESTORE")).andExpect(status().isConflict());
        // A stale token is refused before the state is looked at.
        send(patch(MOD + "/" + id + "/publication"), modToken, Map.of("action", "RESTORE", "reviewToken", "a".repeat(64)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_REVIEW_STALE"));
    }

    @Test
    void onlyActiveModeratorsMayUseTheModeratorApi() throws Exception {
        String id = pending();
        get(MOD, adminToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(MOD + "/" + id, authorToken).andExpect(status().isForbidden());
        get(MOD, null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        get(MOD, "not.a.jwt").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_INVALID_ACCESS_TOKEN"));
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", moderator);
        get(MOD, modToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        review(id, modToken, Map.of("decision", "APPROVE", "reviewToken", "a".repeat(64))).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ learner

    @Test
    void guestsReadListAndDetailWithoutHintOrSampleAnswer() throws Exception {
        String id = published();
        pending();
        var list = get(PUB, null).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(list).doesNotContain("\"hint\"").doesNotContain("\"sampleAnswer\"").doesNotContain("bytecode");
        var item = mapper.readTree(list).path("data").path("content");
        assertThat(item).hasSize(1);
        assertThat(item.get(0).path("question").asText()).isEqualTo("What is the JVM?");
        assertThat(item.get(0).path("author").path("id").asText()).isEqualTo(author.toString());
        assertThat(item.get(0).path("topic").path("name").asText()).isEqualTo("Backend");
        assertThat(item.get(0).path("viewer").isNull()).isTrue();

        var detail = get(PUB + "/" + id, null).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(detail).doesNotContain("\"hint\"").doesNotContain("\"sampleAnswer\"");
        assertThat(mapper.readTree(detail).at("/data/hasHint").asBoolean()).isTrue();
        assertThat(data(get(PUB + "/options", null)).get(0).path("name").asText()).isEqualTo("Backend");

        get(PUB + "/" + id + "/answer", null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        send(put(PUB + "/" + id + "/mark"), null, Map.of("saved", true)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        get(PUB + "?mark=SAVED", null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        get(PUB + "/" + id, "not.a.jwt").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_INVALID_ACCESS_TOKEN"));
        get(PUB + "/" + UUID.randomUUID(), null).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INTERVIEW_QUESTION_NOT_FOUND"));
    }

    @Test
    void signedInReadersSeeAnswersAndMarkIdempotently() throws Exception {
        String id = published();
        var answer = data(get(PUB + "/" + id + "/answer", learnerToken).andExpect(status().isOk()));
        assertThat(answer.path("hint").asText()).isEqualTo("Think of bytecode");
        assertThat(answer.path("sampleAnswer").asText()).contains("bytecode");
        get(PUB + "/" + id + "/answer", authorToken).andExpect(status().isOk());

        mark(id, Map.of()).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mark(id, Map.of("saved", true)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.saved").value(true)).andExpect(jsonPath("$.data.reviewed").value(false));
        var savedAt = jdbc.queryForObject("SELECT saved_at FROM techverse.interview_question_marks", java.sql.Timestamp.class);
        mark(id, Map.of("saved", true)).andExpect(status().isOk()).andExpect(jsonPath("$.data.saved").value(true));
        assertThat(jdbc.queryForObject("SELECT saved_at FROM techverse.interview_question_marks", java.sql.Timestamp.class)).isEqualTo(savedAt);
        mark(id, Map.of("reviewed", true)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.saved").value(true)).andExpect(jsonPath("$.data.reviewed").value(true));

        var viewer = data(get(PUB, learnerToken)).path("content").get(0).path("viewer");
        assertThat(viewer.path("saved").asBoolean()).isTrue();
        assertThat(viewer.path("reviewed").asBoolean()).isTrue();
        assertThat(data(get(PUB + "/" + id, learnerToken)).path("viewer").path("saved").asBoolean()).isTrue();
        assertThat(data(get(PUB + "?mark=SAVED", learnerToken)).path("content")).hasSize(1);
        assertThat(data(get(PUB + "?mark=REVIEWED", learnerToken)).path("content")).hasSize(1);
        assertThat(data(get(PUB + "?mark=SAVED", authorToken)).path("content")).isEmpty();

        mark(id, Map.of("saved", false)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.saved").value(false)).andExpect(jsonPath("$.data.reviewed").value(true));
        assertThat(data(get(PUB + "?mark=SAVED", learnerToken)).path("content")).isEmpty();
        mark(id, Map.of("reviewed", false)).andExpect(status().isOk());
        // Unmarking keeps the row with both stamps NULL.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.interview_question_marks WHERE saved_at IS NULL AND reviewed_at IS NULL",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void hiddenOrSuspendedContentDisappearsAndComesBackAndLockedAccountsAreOut() throws Exception {
        String id = published();
        mark(id, Map.of("saved", true)).andExpect(status().isOk());

        jdbc.update("UPDATE techverse.interview_questions SET status='HIDDEN', hidden_from_status='PUBLISHED' WHERE id=?::uuid", id);
        get(PUB + "/" + id, learnerToken).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INTERVIEW_QUESTION_NOT_FOUND"));
        get(PUB + "/" + id + "/answer", learnerToken).andExpect(status().isNotFound());
        mark(id, Map.of("saved", false)).andExpect(status().isNotFound());
        assertThat(data(get(PUB + "?mark=SAVED", learnerToken)).path("content")).isEmpty();
        jdbc.update("UPDATE techverse.interview_questions SET status='PUBLISHED', hidden_from_status=NULL WHERE id=?::uuid", id);
        assertThat(data(get(PUB + "?mark=SAVED", learnerToken)).path("content")).hasSize(1);

        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        assertThat(data(get(PUB, null)).path("content")).isEmpty();
        get(PUB + "/" + id, null).andExpect(status().isNotFound());
        jdbc.update("UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?", author);
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", author);
        assertThat(data(get(PUB, null)).path("content")).isEmpty();
        jdbc.update("UPDATE techverse.users SET is_active=true WHERE id=?", author);

        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", learner);
        get(PUB + "/" + id + "/answer", learnerToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mark(id, Map.of("saved", true)).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(PUB + "?mark=SAVED", learnerToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void parallelFirstMarksOnDifferentFieldsKeepBoth() throws Exception {
        for (int round = 0; round < 3; round++) {
            String id = published();
            var pool = Executors.newFixedThreadPool(2);
            try {
                var latch = new CountDownLatch(1);
                List<Future<Integer>> results = new ArrayList<>();
                for (String field : List.of("saved", "reviewed"))
                    results.add(pool.submit(() -> {
                        latch.await();
                        return mark(id, Map.of(field, true)).andReturn().getResponse().getStatus();
                    }));
                latch.countDown();
                for (var f : results) assertThat(f.get(30, TimeUnit.SECONDS)).isEqualTo(200);
            } finally {
                pool.shutdownNow();
            }
            assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.interview_question_marks WHERE question_id=?::uuid"
                    + " AND saved_at IS NOT NULL AND reviewed_at IS NOT NULL", Integer.class, id)).isEqualTo(1);
        }
    }

    // ------------------------------------------------------------------ AI feedback (1c)

    static final String FEEDBACK_QUOTA = "/api/v1/me/interview-feedback/quota";

    @Test
    void aiFeedbackNeedsLoginSpendsOneUseAndNeverEchoesTheSampleAnswer() throws Exception {
        redisTemplate.delete(redisTemplate.keys("ai:*"));
        org.mockito.Mockito.when(chatModel.getDefaultOptions()).thenReturn(org.springframework.ai.openai.OpenAiChatOptions.builder().model("m").build());
        org.mockito.Mockito.when(chatModel.call(org.mockito.ArgumentMatchers.any(org.springframework.ai.chat.prompt.Prompt.class)))
                .thenReturn(new org.springframework.ai.chat.model.ChatResponse(List.of(new org.springframework.ai.chat.model.Generation(
                        new org.springframework.ai.chat.messages.AssistantMessage(
                                "{\"verdict\":\"GOOD\",\"strengths\":[\"Mentions bytecode\"],\"missing\":[],\"advice\":\"Add an example.\"}"),
                        org.springframework.ai.chat.metadata.ChatGenerationMetadata.builder().finishReason("STOP").build()))));
        String id = published();
        String path = PUB + "/" + id + "/feedback";

        send(post(path), null, Map.of("answer", "It runs bytecode")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        get(FEEDBACK_QUOTA, null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        send(post(path), learnerToken, Map.of("answer", "   ")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        var r = send(post(path), learnerToken, Map.of("answer", "It runs bytecode")).andExpect(status().isOk())
                .andExpect(header().string("X-AI-Quota-Limit", "20")).andExpect(header().string("X-AI-Quota-Remaining", "19"))
                .andExpect(jsonPath("$.data.verdict").value("GOOD"))
                .andExpect(jsonPath("$.data.strengths[0]").value("Mentions bytecode"))
                .andExpect(jsonPath("$.data.advice").value("Add an example.")).andReturn();
        assertThat(r.getResponse().getContentAsString()).doesNotContain("sampleAnswer").doesNotContain("virtual machine");
        assertThat(data(get(FEEDBACK_QUOTA, learnerToken).andExpect(status().isOk())).path("remaining").asInt()).isEqualTo(19);

        jdbc.update("UPDATE techverse.interview_questions SET status='HIDDEN', hidden_from_status='PUBLISHED' WHERE id=?::uuid", id);
        send(post(path), learnerToken, Map.of("answer", "It runs bytecode")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INTERVIEW_QUESTION_NOT_FOUND"));
        assertThat(data(get(FEEDBACK_QUOTA, learnerToken)).path("remaining").asInt()).isEqualTo(19);
        org.mockito.Mockito.verify(chatModel, org.mockito.Mockito.times(1)).call(org.mockito.ArgumentMatchers.any(org.springframework.ai.chat.prompt.Prompt.class));

        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", learner);
        get(FEEDBACK_QUOTA, learnerToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ------------------------------------------------------------------ fixtures

    String draft() throws Exception {
        var body = Map.of("topicId", topic, "level", "MEDIUM", "question", "What is the JVM?",
                "sampleAnswer", "A virtual machine that runs **bytecode**.", "hint", "Think of bytecode");
        return data(send(post(AUTHOR), authorToken, body).andExpect(status().isCreated())).path("id").asText();
    }

    String pending() throws Exception {
        String id = draft();
        send(post(AUTHOR + "/" + id + "/submit"), authorToken, Map.of()).andExpect(status().isOk());
        return id;
    }

    String published() throws Exception {
        String id = pending();
        String token = data(get(MOD + "/" + id, modToken)).path("reviewToken").asText();
        review(id, modToken, Map.of("decision", "APPROVE", "reviewToken", token)).andExpect(status().isOk());
        return id;
    }

    ResultActions review(String id, String token, Map<String, ?> body) throws Exception {
        return send(patch(MOD + "/" + id + "/review"), token, body);
    }

    /** Publication with the current token. */
    ResultActions publication(String id, Map<String, String> body) throws Exception {
        var b = new HashMap<String, Object>(body);
        b.put("reviewToken", data(get(MOD + "/" + id, modToken)).path("reviewToken").asText());
        return send(patch(MOD + "/" + id + "/publication"), modToken, b);
    }

    ResultActions mark(String id, Map<String, ?> body) throws Exception {
        return send(put(PUB + "/" + id + "/mark"), learnerToken, body);
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

    UUID user(String email, String role) {
        UUID id = users.saveAndFlush(User.createLocalAccount("User " + email, email, encoder.encode("SecurePass123!"))).getId();
        if (role != null) jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name=?", id, role);
        if ("AUTHOR".equals(role))
            jdbc.update("INSERT INTO techverse.author_profiles(user_id,bio,expertise,status) VALUES (?,'Bio','Java','APPROVED')", id);
        return id;
    }

    String login(String email) throws Exception {
        var r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "SecurePass123!"))))
                .andExpect(status().isOk()).andReturn();
        return mapper.readTree(r.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
