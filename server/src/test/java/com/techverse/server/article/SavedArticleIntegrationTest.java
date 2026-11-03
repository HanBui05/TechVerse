package com.techverse.server.article;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.entity.Article;
import com.techverse.server.entity.User;
import com.techverse.server.repository.UserRepository;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.SessionFactory;
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

class SavedArticleIntegrationTest extends ArticleIntegrationTestBase {
    static final String ARTICLES = "/api/v1/articles";
    static final String SAVED_LIST = "/api/v1/me/saved-articles";
    static final String AUTHOR = "/api/v1/author/articles";
    static final String MOD = "/api/v1/moderator/articles";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired EntityManagerFactory emf;
    UUID learner, author, topic, tag;
    String token, authorToken, modToken, adminToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute(
                "INSERT INTO techverse.roles(name) VALUES"
                        + " ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        learner = user("reader@example.com", null);
        author = user("writer@example.com", "AUTHOR");
        user("mod@example.com", "MODERATOR");
        user("admin@example.com", "ADMIN");
        token = login("reader@example.com");
        authorToken = login("writer@example.com");
        modToken = login("mod@example.com");
        adminToken = login("admin@example.com");
        topic = taxonomy("topics", "Backend");
        tag = taxonomy("tags", "Java");
    }

    @Test
    void putAndDeleteAreIdempotentForEveryAuthenticatedRole() throws Exception {
        UUID id = published("Shared");
        for (String t : List.of(token, authorToken, modToken, adminToken)) {
            for (int i = 0; i < 2; i++)
                save(t, id)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value(200))
                        .andExpect(jsonPath("$.data.saved").value(true));
        }
        assertThat(rows(id)).isEqualTo(4);
        for (String t : List.of(token, authorToken, modToken, adminToken)) {
            for (int i = 0; i < 2; i++)
                unsave(t, id)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.saved").value(false));
        }
        assertThat(rows(id)).isZero();
    }

    @Test
    void concurrentPutsCreateOneRowWithoutServerError() throws Exception {
        UUID id = published("Race");
        var pool = Executors.newFixedThreadPool(8);
        var start = new CountDownLatch(1);
        var results = new ArrayList<Future<Integer>>();
        for (int i = 0; i < 8; i++)
            results.add(
                    pool.submit(
                            () -> {
                                start.await();
                                return save(token, id).andReturn().getResponse().getStatus();
                            }));
        start.countDown();
        for (var result : results) assertThat(result.get(30, TimeUnit.SECONDS)).isEqualTo(200);
        pool.shutdown();
        assertThat(rows(id)).isEqualTo(1);
    }

    @Test
    void putRequiresVisibleArticleWhileDeleteNeverRevealsState() throws Exception {
        UUID draft = create("SAVE", "Draft");
        UUID pending = create("SUBMIT", "Pending");
        UUID hidden = published("Hidden");
        save(token, hidden).andExpect(status().isOk());
        authorPublication(hidden, "HIDE");
        for (UUID id : List.of(draft, pending, hidden, UUID.randomUUID()))
            save(token, id)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("ARTICLE_NOT_FOUND"));
        assertThat(rows(draft) + rows(pending)).isZero();
        assertThat(rows(hidden)).isEqualTo(1);
        for (UUID id : List.of(hidden, draft, UUID.randomUUID()))
            unsave(token, id)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.saved").value(false));
        assertThat(rows(hidden)).isZero();
    }

    @Test
    void securityAllowsOnlyTheSavedRoutesForActiveAccounts() throws Exception {
        UUID id = published("Secure");
        mvc.perform(put(ARTICLES + "/" + id + "/saved")).andExpect(status().isUnauthorized());
        mvc.perform(delete(ARTICLES + "/" + id + "/saved")).andExpect(status().isUnauthorized());
        mvc.perform(get(SAVED_LIST)).andExpect(status().isUnauthorized());
        mvc.perform(post(ARTICLES + "/" + id + "/saved").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        mvc.perform(put(ARTICLES + "/" + id).header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", learner);
        save(token, id).andExpect(status().isForbidden());
        unsave(token, id).andExpect(status().isForbidden());
        savedList("").andExpect(status().isForbidden());
    }

    @Test
    void savedListFiltersPagesAndOrdersBySavedTimeWithPublicShape() throws Exception {
        UUID older = published("Spring older");
        UUID newer = published("Spring newer");
        UUID other = published("Kotlin");
        UUID notMine = published("Spring not saved");
        for (UUID id : List.of(older, newer, other)) save(token, id).andExpect(status().isOk());
        save(authorToken, notMine).andExpect(status().isOk());
        savedAt(older, "2026-01-01T00:00:00Z");
        savedAt(newer, "2026-01-03T00:00:00Z");
        savedAt(other, "2026-01-02T00:00:00Z");

        var page =
                json(savedList("?size=2"))
                        .at("/data");
        assertThat(page.at("/totalElements").asInt()).isEqualTo(3);
        assertThat(ids(page)).containsExactly(newer.toString(), other.toString());
        var item = page.at("/content/0");
        assertThat(item.at("/saved").asBoolean()).isTrue();
        assertThat(item.at("/savedAt").asText()).startsWith("2026-01-03");
        assertThat(item.at("/title").asText()).isEqualTo("Spring newer");
        assertThat(item.at("/topic/name").asText()).isEqualTo("Backend");
        assertThat(item.at("/tags/0/name").asText()).isEqualTo("Java");
        assertThat(item.at("/author/fullName").asText()).isEqualTo("Test user");
        assertThat(item.at("/readingMinutes").asInt()).isEqualTo(1);
        assertThat(item.at("/versionNumber").asInt()).isEqualTo(1);
        for (String field : List.of("content", "saveCount", "workflowStatus", "email"))
            assertThat(item.has(field)).as(field).isFalse();
        assertThat(ids(json(savedList("?size=2&page=1")).at("/data")))
                .containsExactly(older.toString());
        assertThat(ids(json(savedList("?keyword=SPRING")).at("/data")))
                .containsExactly(newer.toString(), older.toString());
        for (String query : List.of("?keyword=" + "x".repeat(256), "?size=0", "?size=101", "?page=-1"))
            savedList(query)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void invisibleRowsAreKeptAndReappearWhenTheArticleIsVisibleAgain() throws Exception {
        UUID hidden = published("Author hidden");
        UUID moderated = published("Moderator hidden");
        UUID deleted = published("Soft deleted");
        for (UUID id : List.of(hidden, moderated, deleted)) save(token, id).andExpect(status().isOk());
        authorPublication(hidden, "HIDE");
        modPublication(moderated, "HIDE", "Spam");
        mvc.perform(delete(AUTHOR + "/" + deleted).header("Authorization", bearer(authorToken)))
                .andExpect(status().isOk());
        assertThat(json(savedList("")).at("/data/totalElements").asInt()).isZero();
        assertThat(rows(hidden) + rows(moderated) + rows(deleted)).isEqualTo(3);

        authorPublication(hidden, "UNHIDE");
        modPublication(moderated, "RESTORE", null);
        assertThat(ids(json(savedList("")).at("/data")))
                .containsExactlyInAnyOrder(hidden.toString(), moderated.toString());

        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        assertThat(json(savedList("")).at("/data/totalElements").asInt()).isZero();
        jdbc.update("UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?", author);
        assertThat(json(savedList("")).at("/data/totalElements").asInt()).isEqualTo(2);
        assertThat(rows(deleted)).isEqualTo(1);
    }

    @Test
    void savedListQueryCountDoesNotGrowWithRows() throws Exception {
        save(token, published("First")).andExpect(status().isOk());
        var stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        savedList("").andExpect(status().isOk());
        long baseline = stats.getPrepareStatementCount();
        for (int i = 0; i < 6; i++) save(token, published("Article " + i)).andExpect(status().isOk());
        stats.clear();
        savedList("").andExpect(jsonPath("$.data.content.length()").value(7));
        assertThat(stats.getPrepareStatementCount()).isEqualTo(baseline);
        assertThat(stats.getEntityStatistics(Article.class.getName()).getLoadCount()).isZero();
    }

    private ResultActions save(String t, UUID id) throws Exception {
        return mvc.perform(put(ARTICLES + "/" + id + "/saved").header("Authorization", bearer(t)));
    }

    private ResultActions unsave(String t, UUID id) throws Exception {
        return mvc.perform(
                delete(ARTICLES + "/" + id + "/saved").header("Authorization", bearer(t)));
    }

    private ResultActions savedList(String query) throws Exception {
        return mvc.perform(get(SAVED_LIST + query).header("Authorization", bearer(token)));
    }

    private int rows(UUID article) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM techverse.saved_articles WHERE article_id=?",
                Integer.class,
                article);
    }

    private void savedAt(UUID article, String at) {
        jdbc.update(
                "UPDATE techverse.saved_articles SET created_at=?::timestamptz WHERE article_id=?"
                        + " AND user_id=?",
                at,
                article,
                learner);
    }

    private List<String> ids(JsonNode page) {
        var ids = new ArrayList<String>();
        page.at("/content").forEach(node -> ids.add(node.at("/id").asText()));
        return ids;
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

    private UUID taxonomy(String table, String name) {
        return jdbc.queryForObject(
                "INSERT INTO techverse." + table + "(name) VALUES (?) RETURNING id",
                UUID.class,
                name);
    }

    private UUID create(String action, String title) throws Exception {
        var body =
                Map.of(
                        "action", action,
                        "title", title,
                        "topicId", topic,
                        "tagIds", List.of(tag),
                        "summary", "Summary",
                        "content", "# Saved\nBody");
        var r =
                mvc.perform(
                                post(AUTHOR)
                                        .header("Authorization", bearer(authorToken))
                                        .header("Idempotency-Key", UUID.randomUUID().toString())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(mapper.writeValueAsString(body)))
                        .andExpect(status().isCreated())
                        .andReturn();
        return UUID.fromString(
                mapper.readTree(r.getResponse().getContentAsString()).at("/data/id").asText());
    }

    private UUID published(String title) throws Exception {
        UUID id = create("SUBMIT", title);
        var body = new HashMap<String, Object>();
        body.put("decision", "APPROVE");
        body.put("reviewToken", reviewToken(id));
        mvc.perform(
                        patch(MOD + "/" + id + "/review")
                                .header("Authorization", bearer(modToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(mapper.writeValueAsString(body)))
                .andExpect(status().isOk());
        return id;
    }

    private void modPublication(UUID id, String action, String note) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("action", action);
        body.put("reviewToken", reviewToken(id));
        body.put("moderationNote", note);
        mvc.perform(
                        patch(MOD + "/" + id + "/publication")
                                .header("Authorization", bearer(modToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(mapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private void authorPublication(UUID id, String action) throws Exception {
        mvc.perform(
                        patch(AUTHOR + "/" + id + "/publication")
                                .header("Authorization", bearer(authorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"action\":\"" + action + "\"}"))
                .andExpect(status().isOk());
    }

    private String reviewToken(UUID id) throws Exception {
        return json(mvc.perform(get(MOD + "/" + id).header("Authorization", bearer(modToken))))
                .at("/data/reviewToken")
                .asText();
    }

    private String login(String email) throws Exception {
        var result =
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
        return mapper.readTree(result.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }

    private JsonNode json(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private String bearer(String t) {
        return "Bearer " + t;
    }
}
