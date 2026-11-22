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

/** Shared setup and calls for the messaging integration classes (one Spring context, real database and security). */
abstract class ConversationIntegrationTestBase extends ArticleIntegrationTestBase {
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
        redisTemplate.delete(redisTemplate.keys("forum:rate:*"));
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
