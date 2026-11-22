package com.techverse.server.forum;

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

/** Shared fixture of the forum integration classes: five accounts, two topics, a clean rate-limit key space. */
abstract class ForumIntegrationTestBase extends ArticleIntegrationTestBase {
    static final String API = "/api/v1/forum";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired StringRedisTemplate redisTemplate;
    @Autowired javax.sql.DataSource dataSource;
    // Same override set as the other integration classes so every one shares a Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;

    UUID asker, helper, topic, otherTopic;
    String askerToken, helperToken, thirdToken, modToken, adminToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        asker = user("asker@example.com", null);
        helper = user("helper@example.com", null);
        user("third@example.com", null);
        user("mod@example.com", "MODERATOR");
        user("admin@example.com", "ADMIN");
        askerToken = login("asker@example.com");
        helperToken = login("helper@example.com");
        thirdToken = login("third@example.com");
        modToken = login("mod@example.com");
        adminToken = login("admin@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        otherTopic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Frontend') RETURNING id", UUID.class);
        redisTemplate.delete(redisTemplate.keys("forum:rate:*"));
    }

    // ------------------------------------------------------------------ helpers

    interface Call {
        ResultActions run(String token) throws Exception;
    }

    List<String> race(List<String> tokens, Call call) throws Exception {
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

    Map<String, String> question(String title, String content, UUID topicId) {
        return Map.of("title", title, "content", content, "topicId", topicId.toString());
    }

    String ask(String token, String title, String content) throws Exception {
        return ask(token, title, content, topic);
    }

    String ask(String token, String title, String content, UUID topicId) throws Exception {
        return data(send(post(API + "/questions"), token, question(title, content, topicId)).andExpect(status().isOk())).path("id").asText();
    }

    String answer(String token, String q, String content) throws Exception {
        return data(send(post(API + "/questions/" + q + "/answers"), token, Map.of("content", content)).andExpect(status().isOk()))
                .path("id").asText();
    }

    ResultActions accept(String q, String token, String answerId) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("answerId", answerId);
        return send(put(API + "/questions/" + q + "/accepted-answer"), token, body);
    }

    List<String> ids(ResultActions result) throws Exception {
        return topIds(data(result.andExpect(status().isOk())).path("content"));
    }

    static List<String> topIds(JsonNode array) {
        var out = new ArrayList<String>();
        array.forEach(n -> out.add(n.path("id").asText()));
        return out;
    }

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

    ResultActions search(String keyword) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(API + "/questions").param("keyword", keyword));
    }

    JsonNode data(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    UUID user(String email, String role) {
        UUID id = users.saveAndFlush(User.createLocalAccount("User " + email, email, encoder.encode("SecurePass123!"))).getId();
        if (role != null) jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name=?", id, role);
        return id;
    }

    String login(String email) throws Exception {
        var r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "SecurePass123!"))))
                .andExpect(status().isOk()).andReturn();
        return mapper.readTree(r.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
