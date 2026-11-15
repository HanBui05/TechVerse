package com.techverse.server.course;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.article.ArticleIntegrationTestBase;
import com.techverse.server.entity.User;
import com.techverse.server.repository.*;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.*;

/** Users, author-API course builders and moderator approval shared by the 1c course test classes. */
abstract class CourseIntegrationTestBase extends ArticleIntegrationTestBase {
    static final String AUTHOR = "/api/v1/author/courses";
    static final String MOD = "/api/v1/moderator/courses";
    static final String PUBLIC = "/api/v1/courses";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    // Same override set as AuthorCourseIntegrationTest so every course class shares one Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;

    UUID author, learner, moderator, topic, tag;
    String authorToken, learnerToken, modToken, adminToken;

    @BeforeEach
    void baseSetup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        author = user("author@example.com", "AUTHOR");
        learner = user("learner@example.com", null);
        moderator = user("mod@example.com", "MODERATOR");
        user("admin@example.com", "ADMIN");
        authorToken = login("author@example.com");
        learnerToken = login("learner@example.com");
        modToken = login("mod@example.com");
        adminToken = login("admin@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        tag = jdbc.queryForObject("INSERT INTO techverse.tags(name) VALUES ('Java') RETURNING id", UUID.class);
        when(imageStorage.configured()).thenReturn(true);
    }

    // ------------------------------------------------------------------ author side

    /** Draft course with the given chapters; each chapter title maps to its lesson titles. */
    String course(String title, LinkedHashMap<String, List<String>> tree) throws Exception {
        String id = data(send(post(AUTHOR).header("Idempotency-Key", UUID.randomUUID().toString()), authorToken, Map.of(
                        "action", "SAVE", "title", title, "topicId", topic, "tagIds", List.of(tag),
                        "summary", "Summary", "description", "Description", "level", "INTERMEDIATE")))
                .path("id").asText();
        for (var chapter : tree.entrySet()) {
            String chapterId = addChapter(id, chapter.getKey());
            boolean first = true;
            for (String lesson : chapter.getValue()) {
                addLesson(id, chapterId, lesson, first);
                first = false;
            }
        }
        return id;
    }

    String addChapter(String course, String title) throws Exception {
        var chapters = data(send(post(AUTHOR + "/" + course + "/chapters"), authorToken, Map.of("title", title))).path("chapters");
        return chapters.get(chapters.size() - 1).path("id").asText();
    }

    String addLesson(String course, String chapter, String title, boolean preview) throws Exception {
        return data(send(post(AUTHOR + "/" + course + "/chapters/" + chapter + "/lessons")
                                .header("Idempotency-Key", UUID.randomUUID().toString()),
                        authorToken,
                        Map.of("title", title, "content", "Body of " + title, "preview", preview)))
                .path("id").asText();
    }

    void submit(String course) throws Exception {
        send(patch(AUTHOR + "/" + course), authorToken, Map.of("action", "SUBMIT")).andExpect(status().isOk());
    }

    /** Submits then approves through the moderator API. */
    void publish(String course) throws Exception {
        submit(course);
        review(course, "APPROVE", null).andExpect(status().isOk());
    }

    /** Two chapters: A = [A1 (preview), A2], B = [B1 (preview)]; published. */
    String publishedCourse(String title) throws Exception {
        var tree = new LinkedHashMap<String, List<String>>();
        tree.put("A", List.of("A1", "A2"));
        tree.put("B", List.of("B1"));
        String id = course(title, tree);
        publish(id);
        return id;
    }

    // ------------------------------------------------------------------ moderator side

    String reviewToken(String course) throws Exception {
        return data(get(MOD + "/" + course, modToken)).path("reviewToken").asText();
    }

    ResultActions review(String course, String decision, String note) throws Exception {
        var body = new HashMap<String, Object>(Map.of("decision", decision, "reviewToken", reviewToken(course)));
        if (note != null) body.put("moderationNote", note);
        return send(patch(MOD + "/" + course + "/review"), modToken, body);
    }

    ResultActions publication(String course, String action, String note) throws Exception {
        var body = new HashMap<String, Object>(Map.of("action", action, "reviewToken", reviewToken(course)));
        if (note != null) body.put("moderationNote", note);
        return send(patch(MOD + "/" + course + "/publication"), modToken, body);
    }

    // ------------------------------------------------------------------ http

    ResultActions send(MockHttpServletRequestBuilder request, String token, Map<String, ?> body) throws Exception {
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
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
        if (role != null)
            jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name=?", id, role);
        if ("AUTHOR".equals(role))
            jdbc.update("INSERT INTO techverse.author_profiles(user_id,bio,expertise,status) VALUES (?,'Bio','Java','APPROVED')", id);
        return id;
    }

    String login(String email) throws Exception {
        var r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "SecurePass123!"))))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(r.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
