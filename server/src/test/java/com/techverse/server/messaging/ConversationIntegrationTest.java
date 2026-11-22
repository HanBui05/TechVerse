package com.techverse.server.messaging;

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

/** Conversations against a real database and security chain, grouped by flow. */
class ConversationIntegrationTest extends ArticleIntegrationTestBase {
    static final String API = "/api/v1/conversations";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired StringRedisTemplate redisTemplate;
    // Same override set as the other integration classes so every one shares a Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;

    UUID learner, author, topic, course1, course2;
    String learnerToken, authorToken, thirdToken, modToken, adminToken, multiToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        learner = user("learner@example.com", null);
        author = user("author@example.com", "AUTHOR");
        user("third@example.com", null);
        user("mod@example.com", "MODERATOR");
        user("admin@example.com", "ADMIN");
        UUID multi = user("multi@example.com", "AUTHOR");
        jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name='MODERATOR'", multi);
        learnerToken = login("learner@example.com");
        authorToken = login("author@example.com");
        thirdToken = login("third@example.com");
        modToken = login("mod@example.com");
        adminToken = login("admin@example.com");
        multiToken = login("multi@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        course1 = course(author, "Course One");
        course2 = course(author, "Course Two");
        redisTemplate.delete(redisTemplate.keys("messaging:rate:*"));
    }

    // ------------------------------------------------------------------ (1) opening

    @Test
    void learnerWithoutPurchaseOpensAndReopensWithTheLatestCourseContext() throws Exception {
        var first = data(open(learnerToken, course1).andExpect(status().isOk()));
        String id = first.path("id").asText();
        assertThat(first.path("role").asText()).isEqualTo("LEARNER");
        assertThat(first.at("/other/id").asText()).isEqualTo(author.toString());
        assertThat(first.at("/contextCourse/title").asText()).isEqualTo("Course One");
        assertThat(first.at("/contextCourse/available").asBoolean()).isTrue();
        assertThat(first.path("contextEnrolled").asBoolean()).isFalse();
        assertThat(first.path("canSend").asBoolean()).isTrue();
        assertThat(first.path("remainingBeforeReply").asInt()).isEqualTo(3);

        // Reopening from another course of the same author returns the same conversation with the new context.
        jdbc.update("INSERT INTO techverse.course_enrollments(user_id,course_id,source) VALUES (?,?,'FREE')", learner, course2);
        var again = data(open(learnerToken, course2).andExpect(status().isOk()));
        assertThat(again.path("id").asText()).isEqualTo(id);
        assertThat(again.at("/contextCourse/id").asText()).isEqualTo(course2.toString());
        assertThat(again.path("contextEnrolled").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.conversations", Integer.class)).isEqualTo(1);

        // The context course hidden afterwards: still named, no longer available; cannot open from it.
        jdbc.update("UPDATE techverse.courses SET publication_status='HIDDEN', hidden_from_publication_status='PUBLISHED' WHERE id=?", course2);
        var detail = data(get(API + "/" + id, learnerToken).andExpect(status().isOk()));
        assertThat(detail.at("/contextCourse/title").asText()).isEqualTo("Course Two");
        assertThat(detail.at("/contextCourse/available").asBoolean()).isFalse();
        open(learnerToken, course2).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_ALLOWED"));
        open(authorToken, course1).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_ALLOWED"));
        open(learnerToken, UUID.randomUUID()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_ALLOWED"));
        send(post(API), learnerToken, Map.of("courseId", "abc")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        send(post(API), null, Map.of("courseId", course1.toString())).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ (2) chatting

    @Test
    void learnerWaitsForTheFirstReplyThenBothSidesChatAndRead() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        for (int i = 1; i <= 3; i++) message(id, learnerToken, "Question " + i).andExpect(status().isCreated());
        message(id, learnerToken, "Question 4").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_AWAITING_REPLY"));
        var waiting = data(get(API + "/" + id, learnerToken));
        assertThat(waiting.path("remainingBeforeReply").asInt()).isZero();
        assertThat(waiting.path("canSend").asBoolean()).isFalse();

        // The author sees it as unread; the learner has nothing unread (own messages).
        var authorList = data(get(API, authorToken).andExpect(status().isOk())).path("content");
        assertThat(authorList).hasSize(1);
        assertThat(authorList.get(0).path("role").asText()).isEqualTo("AUTHOR");
        assertThat(authorList.get(0).path("unread").asBoolean()).isTrue();
        assertThat(authorList.get(0).path("lastMessageExcerpt").asText()).isEqualTo("Question 3");
        assertThat(authorList.get(0).path("contextEnrolled").asBoolean()).isFalse();
        assertThat(unread(authorToken)).isEqualTo(1);
        assertThat(unread(learnerToken)).isZero();

        var reply = data(message(id, authorToken, "Answer").andExpect(status().isCreated()));
        assertThat(reply.path("mine").asBoolean()).isTrue();
        var afterReply = data(get(API + "/" + id, learnerToken));
        assertThat(afterReply.path("remainingBeforeReply").isNull()).isTrue();
        assertThat(afterReply.path("canSend").asBoolean()).isTrue();
        assertThat(data(get(API + "/" + id, authorToken)).path("remainingBeforeReply").isNull()).isTrue();
        // Sending does not move the sender's own read marker: the author still has unread until reading.
        assertThat(unread(learnerToken)).isEqualTo(1);
        for (int i = 4; i <= 8; i++) message(id, learnerToken, "Question " + i).andExpect(status().isCreated());

        // Latest page, then older pages, all in ascending seq.
        var latest = data(get(API + "/" + id + "/messages?size=3", learnerToken).andExpect(status().isOk()));
        assertThat(contents(latest)).containsExactly("Question 6", "Question 7", "Question 8");
        assertThat(latest.path("hasMore").asBoolean()).isTrue();
        long oldest = latest.at("/messages/0/seq").asLong();
        var older = data(get(API + "/" + id + "/messages?size=50&beforeSeq=" + oldest, learnerToken));
        assertThat(contents(older)).containsExactly("Question 1", "Question 2", "Question 3", "Answer", "Question 4", "Question 5");
        assertThat(older.path("hasMore").asBoolean()).isFalse();

        // Catching up in pages of 4 from the start until hasMore is false.
        var all = new ArrayList<String>();
        long after = 0;
        boolean more = true;
        while (more) {
            var page = data(get(API + "/" + id + "/messages?size=4&afterSeq=" + after, authorToken));
            all.addAll(contents(page));
            more = page.path("hasMore").asBoolean();
            after = page.at("/messages/" + (page.path("messages").size() - 1) + "/seq").asLong();
        }
        assertThat(all).hasSize(9).startsWith("Question 1").endsWith("Question 8");

        // Reading: never backwards, capped at the last message.
        send(put(API + "/" + id + "/read"), authorToken, Map.of("seq", Long.MAX_VALUE)).andExpect(status().isOk());
        assertThat(unread(authorToken)).isZero();
        send(put(API + "/" + id + "/read"), authorToken, Map.of("seq", 0)).andExpect(status().isOk());
        assertThat(unread(authorToken)).isZero();
        assertThat(jdbc.queryForObject("SELECT author_last_read_seq = last_message_seq FROM techverse.conversations WHERE id=?::uuid", Boolean.class, id))
                .isTrue();
        send(put(API + "/" + id + "/read"), learnerToken, Map.of("seq", -1)).andExpect(status().isBadRequest());
        get(API + "/" + id + "/messages?beforeSeq=5&afterSeq=1", learnerToken).andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ (3) privacy

    @Test
    void outsidersGetNotFoundAndStaffOrLockedAccountsAreDenied() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        String secret = "Top secret message body";
        message(id, learnerToken, secret).andExpect(status().isCreated());

        var outsider = List.of(
                get(API + "/" + id, thirdToken),
                get(API + "/" + id + "/messages", thirdToken),
                message(id, thirdToken, "Let me in"),
                send(put(API + "/" + id + "/read"), thirdToken, Map.of("seq", 1)),
                get(API + "/" + UUID.randomUUID(), learnerToken));
        for (var r : outsider) {
            r.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
            assertThat(r.andReturn().getResponse().getContentAsString()).doesNotContain(secret);
        }
        assertThat(data(get(API, thirdToken)).path("content")).isEmpty();
        assertThat(unread(thirdToken)).isZero();

        UUID locked = user("locked@example.com", null);
        String lockedToken = login("locked@example.com");
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", locked);
        for (String token : List.of(modToken, adminToken, multiToken, lockedToken)) {
            for (var r : List.of(
                    get(API, token), get(API + "/unread-count", token), get(API + "/" + id, token), get(API + "/" + id + "/messages", token),
                    message(id, token, "Hello"), send(put(API + "/" + id + "/read"), token, Map.of("seq", 1)), open(token, course1))) {
                r.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
                assertThat(r.andReturn().getResponse().getContentAsString()).doesNotContain(secret);
            }
        }
    }

    // ------------------------------------------------------------------ (4) concurrency and idempotency

    @Test
    void racesKeepOneConversationAndClientIdsMakeSendingIdempotent() throws Exception {
        assertThat(race(2, () -> open(learnerToken, course1))).containsOnly("200:");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.conversations", Integer.class)).isEqualTo(1);
        String id = data(open(learnerToken, course1)).path("id").asText();

        // Two authors opening from each other's course at once: both succeed (no deadlock on the user rows).
        UUID second = user("second@example.com", "AUTHOR");
        UUID secondCourse = course(second, "Second course");
        String secondToken = login("second@example.com");
        for (int i = 0; i < 5; i++) {
            jdbc.update("DELETE FROM techverse.conversations WHERE learner_id IN (?,?) AND author_id IN (?,?)", author, second, author, second);
            redisTemplate.delete(redisTemplate.keys("messaging:rate:*"));
            assertThat(race(List.of(authorToken, secondToken), t -> open(t, t.equals(authorToken) ? secondCourse : course1))).containsOnly("200:");
        }

        // The same retry sent twice at once: one 201, one 200, one stored message.
        String retry = UUID.randomUUID().toString();
        assertThat(race(2, () -> send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Retry", "clientId", retry))))
                .containsExactlyInAnyOrder("201:", "200:");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.messages WHERE client_id=?::uuid", Integer.class, retry)).isEqualTo(1);
        jdbc.update("DELETE FROM techverse.messages");
        jdbc.update("UPDATE techverse.conversations SET last_message_seq=NULL, last_message_at=NULL, last_message_sender_id=NULL");

        String clientId = UUID.randomUUID().toString();
        var first = data(send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", " Hello ", "clientId", clientId))
                .andExpect(status().isCreated()));
        var resent = data(send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Hello", "clientId", clientId))
                .andExpect(status().isOk()));
        assertThat(resent.path("id").asText()).isEqualTo(first.path("id").asText());
        send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Different", "clientId", clientId))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MESSAGE_CLIENT_ID_CONFLICT"));
        UUID other = user("other@example.com", "AUTHOR");
        String elsewhere = data(open(learnerToken, course(other, "Other course"))).path("id").asText();
        send(post(API + "/" + elsewhere + "/messages"), learnerToken, Map.of("content", "Hello", "clientId", clientId))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MESSAGE_CLIENT_ID_CONFLICT"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.messages", Integer.class)).isEqualTo(1);

        // Third and fourth messages before any reply, sent together: exactly one is stored.
        message(id, learnerToken, "Second").andExpect(status().isCreated());
        assertThat(race(2, () -> message(id, learnerToken, "Racing " + UUID.randomUUID())))
                .containsExactlyInAnyOrder("201:", "409:CONVERSATION_AWAITING_REPLY");

        // Both sides at once: both stored, the higher seq is the last message.
        message(id, authorToken, "Reply").andExpect(status().isCreated());
        var codes = race(List.of(learnerToken, authorToken), t -> message(id, t, "Same time " + t.hashCode()));
        assertThat(codes).containsOnly("201:");
        assertThat(jdbc.queryForObject("SELECT c.last_message_seq = (SELECT max(seq) FROM techverse.messages m WHERE m.conversation_id=c.id)"
                + " FROM techverse.conversations c WHERE c.id=?::uuid", Boolean.class, id)).isTrue();
    }

    // ------------------------------------------------------------------ helpers

    interface Call {
        ResultActions run() throws Exception;
    }

    interface TokenCall {
        ResultActions run(String token) throws Exception;
    }

    List<String> race(int n, Call call) throws Exception {
        var tokens = new ArrayList<String>();
        for (int i = 0; i < n; i++) tokens.add("");
        return race(tokens, t -> call.run());
    }

    List<String> race(List<String> tokens, TokenCall call) throws Exception {
        var pool = Executors.newFixedThreadPool(tokens.size());
        try {
            var latch = new CountDownLatch(1);
            List<Future<String>> results = new ArrayList<>();
            for (String t : tokens)
                results.add(pool.submit(() -> {
                    latch.await();
                    var r = call.run(t).andReturn().getResponse();
                    return r.getStatus() + ":" + mapper.readTree(r.getContentAsString()).path("code").asText();
                }));
            latch.countDown();
            var codes = new ArrayList<String>();
            for (var f : results) codes.add(f.get(30, TimeUnit.SECONDS));
            return codes;
        } finally {
            pool.shutdownNow();
        }
    }

    UUID course(UUID owner, String title) {
        UUID c = jdbc.queryForObject("INSERT INTO techverse.courses(author_id, topic_id, title, summary, description, level, content_fingerprint)"
                + " VALUES (?,?,?,'S','D','BEGINNER',repeat('a',64)) RETURNING id", UUID.class, owner, topic, title);
        UUID v = jdbc.queryForObject("INSERT INTO techverse.course_publication_versions(course_id, version_number, title, summary, description, level,"
                + " topic_id, content_fingerprint, approved_at) VALUES (?,1,?,'S','D','BEGINNER',?,repeat('a',64),now()) RETURNING id",
                UUID.class, c, title, topic);
        jdbc.update("UPDATE techverse.courses SET publication_status='PUBLISHED', workflow_status='PUBLISHED', published_version_id=?, published_at=now()"
                + " WHERE id=?", v, c);
        return c;
    }

    ResultActions open(String token, UUID courseId) throws Exception {
        return send(post(API), token, Map.of("courseId", courseId.toString()));
    }

    ResultActions message(String id, String token, String content) throws Exception {
        return send(post(API + "/" + id + "/messages"), token, Map.of("content", content, "clientId", UUID.randomUUID().toString()));
    }

    long unread(String token) throws Exception {
        return data(get(API + "/unread-count", token).andExpect(status().isOk())).path("count").asLong();
    }

    static List<String> contents(JsonNode page) {
        var out = new ArrayList<String>();
        page.path("messages").forEach(m -> out.add(m.path("content").asText()));
        return out;
    }

    ResultActions send(MockHttpServletRequestBuilder request, String token, Map<String, ?> body) throws Exception {
        if (token != null && !token.isEmpty()) request.header("Authorization", "Bearer " + token);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        return mvc.perform(request);
    }

    ResultActions get(String path, String token) throws Exception {
        return send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path), token, null);
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
