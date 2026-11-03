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
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.*;

/** Reader APIs over approved snapshots; every fixture article goes through the real APIs. */
@Testcontainers
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublishedArticleIntegrationTest {
    static final String ROOT = "/api/v1/articles";
    static final String AUTHOR = "/api/v1/author/articles";
    static final String MOD = "/api/v1/moderator/articles";
    static final String CONTENT = "# Markdown\n```java\nint i = 1;\n```";

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Container
    @ServiceConnection(name = "redis")
    static GenericContainer<?> redis =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired EntityManagerFactory emf;
    UUID learner, author, topic, tag;
    String token, authorToken, modToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute(
                "INSERT INTO techverse.roles(name) VALUES"
                        + " ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        learner = user("reader@example.com", null);
        author = user("writer@example.com", "AUTHOR");
        user("mod@example.com", "MODERATOR");
        token = login("reader@example.com");
        authorToken = login("writer@example.com");
        modToken = login("mod@example.com");
        topic = taxonomy("topics", "Backend");
        tag = taxonomy("tags", "Java");
    }

    @Test
    void learnerReadsSnapshotFieldsWithoutPrivateData() throws Exception {
        String bio = "  " + "😀".repeat(305) + "  ";
        jdbc.update("UPDATE techverse.author_profiles SET bio=? WHERE user_id=?", bio, author);
        UUID id = published("Java guide", topic, tag);
        list().andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(id.toString()))
                .andExpect(jsonPath("$.data.content[0].title").value("Java guide"))
                .andExpect(jsonPath("$.data.content[0].summary").value("Summary"))
                .andExpect(jsonPath("$.data.content[0].author.id").value(author.toString()))
                .andExpect(jsonPath("$.data.content[0].author.fullName").value("Test user"))
                .andExpect(jsonPath("$.data.content[0].topic.id").value(topic.toString()))
                .andExpect(jsonPath("$.data.content[0].topic.name").value("Backend"))
                .andExpect(jsonPath("$.data.content[0].tags[0].id").value(tag.toString()))
                .andExpect(jsonPath("$.data.content[0].publishedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.content[0].approvedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.content[0].versionNumber").value(1))
                .andExpect(jsonPath("$.data.content[0].readingMinutes").value(1))
                .andExpect(jsonPath("$.data.content[0].content").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].updatedAt").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].workflowStatus").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].author.email").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].author.bioExcerpt").doesNotExist());
        var detail =
                json(
                        detail(id)
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.data.content").value(CONTENT))
                                .andExpect(jsonPath("$.data.versionNumber").value(1))
                                .andExpect(jsonPath("$.data.readingMinutes").value(1))
                                .andExpect(jsonPath("$.data.author.expertise").value("Java"))
                                .andExpect(jsonPath("$.data.author.email").doesNotExist())
                                .andExpect(jsonPath("$.data.relatedArticles").isEmpty())
                                .andExpect(jsonPath("$.data.moderationNote").doesNotExist())
                                .andExpect(jsonPath("$.data.publicationStatus").doesNotExist())
                                .andExpect(jsonPath("$.data.history").doesNotExist())
                                .andExpect(jsonPath("$.data.reviewedBy").doesNotExist()));
        String excerpt = detail.at("/data/author/bioExcerpt").asText();
        assertThat(excerpt.codePointCount(0, excerpt.length())).isEqualTo(300);
        assertThat(excerpt).isEqualTo("😀".repeat(300));
        request("/options")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.content[0].id").value(topic.toString()))
                .andExpect(jsonPath("$.data.tags.content[0].id").value(tag.toString()));
    }

    @Test
    void readersKeepTheApprovedSnapshotWhileTheAuthorRevises() throws Exception {
        UUID other = taxonomy("topics", "Frontend");
        UUID id = published("Original", topic, tag);
        String publishedAt = json(detail(id)).at("/data/publishedAt").asText();
        edit(id, "SAVE", Map.of("title", "Draft revision", "content", "# Secret draft", "topicId", other, "tagIds", List.of()));
        list().andExpect(jsonPath("$.data.content[0].title").value("Original"))
                .andExpect(jsonPath("$.data.content[0].topic.id").value(topic.toString()))
                .andExpect(jsonPath("$.data.content[0].tags[0].id").value(tag.toString()));
        detail(id)
                .andExpect(jsonPath("$.data.title").value("Original"))
                .andExpect(jsonPath("$.data.content").value(CONTENT));
        mvc.perform(get(ROOT).header("Authorization", bearer(token)).param("keyword", "Draft revision"))
                .andExpect(jsonPath("$.data.totalElements").value(0));
        mvc.perform(get(ROOT).header("Authorization", bearer(token)).param("topicId", other.toString()))
                .andExpect(jsonPath("$.data.totalElements").value(0));
        request("/options").andExpect(jsonPath("$.data.topics.totalElements").value(1));
        edit(id, "SUBMIT", Map.of());
        detail(id).andExpect(jsonPath("$.data.title").value("Original"));
        approve(id);
        detail(id)
                .andExpect(jsonPath("$.data.id").value(id.toString()))
                .andExpect(jsonPath("$.data.title").value("Draft revision"))
                .andExpect(jsonPath("$.data.content").value("# Secret draft"))
                .andExpect(jsonPath("$.data.topic.id").value(other.toString()))
                .andExpect(jsonPath("$.data.tags").isEmpty())
                .andExpect(jsonPath("$.data.versionNumber").value(2))
                .andExpect(jsonPath("$.data.publishedAt").value(publishedAt));
    }

    @Test
    void authenticationAndGetOnlyBoundaries() throws Exception {
        for (String suffix : List.of("", "/options", "/" + UUID.randomUUID())) {
            mvc.perform(get(ROOT + suffix)).andExpect(status().isUnauthorized());
            mvc.perform(get(ROOT + suffix).header("Authorization", "Bearer invalid"))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post(ROOT).header("Authorization", bearer(token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void inactiveReaderIsForbiddenOnEveryRoute() throws Exception {
        UUID id = published("Visible", topic);
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", learner);
        for (String suffix : List.of("", "/options", "/" + id))
            request(suffix).andExpect(status().isForbidden());
    }

    @Test
    void adminModeratorAndAuthorCanRead() throws Exception {
        UUID id = published("Shared", topic);
        for (String role : List.of("ADMIN", "MODERATOR", "AUTHOR")) {
            jdbc.update(
                    "INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM"
                            + " techverse.roles WHERE name=?",
                    learner,
                    role);
            token = login("reader@example.com");
            list().andExpect(status().isOk());
            detail(id).andExpect(status().isOk());
            request("/options").andExpect(status().isOk());
        }
    }

    @Test
    void onlyVisibleSnapshotsAreReadable() throws Exception {
        UUID visible = published("Visible", topic);
        UUID draft = create("SAVE", "Draft", topic);
        UUID pending = create("SUBMIT", "Pending", topic);
        UUID changes = create("SUBMIT", "Changes", topic);
        review(changes, "REQUEST_CHANGES", "Fix");
        UUID authorHidden = published("Author hidden", topic);
        authorPublication(authorHidden, "HIDE");
        UUID modHidden = published("Moderator hidden", topic);
        modPublication(modHidden, "HIDE", "Spam");
        UUID removed = published("Removed", topic);
        modPublication(removed, "REMOVE", "Illegal");
        UUID deleted = published("Deleted", topic);
        mvc.perform(delete(AUTHOR + "/" + deleted).header("Authorization", bearer(authorToken)))
                .andExpect(status().isOk());
        for (UUID id :
                List.of(draft, pending, changes, authorHidden, modHidden, removed, deleted))
            detail(id)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("ARTICLE_NOT_FOUND"));
        mvc.perform(get(ROOT).header("Authorization", bearer(token)).param("status", "DRAFT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(visible.toString()));
        detail(UUID.randomUUID()).andExpect(status().isNotFound());
        authorPublication(authorHidden, "UNHIDE");
        detail(authorHidden).andExpect(status().isOk());
    }

    @Test
    void ineligibleAuthorHidesArticlesWithoutChangingStatusOrHistory() throws Exception {
        UUID id = published("Eligibility", topic, tag);
        UUID other = user("other@example.com", "AUTHOR");
        String otherAuthor = authorToken;
        authorToken = login("other@example.com");
        UUID kept = published("Other author", topic, tag);
        authorToken = otherAuthor;
        int history = historyCount();
        for (String update :
                List.of(
                        "UPDATE techverse.users SET is_active=false WHERE id=?",
                        "UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?")) {
            jdbc.update(update, author);
            detail(id).andExpect(status().isNotFound());
            list().andExpect(jsonPath("$.data.totalElements").value(1))
                    .andExpect(jsonPath("$.data.content[0].id").value(kept.toString()));
            detail(kept).andExpect(jsonPath("$.data.relatedArticles").isEmpty());
            jdbc.update("UPDATE techverse.users SET is_active=true WHERE id=?", author);
            jdbc.update(
                    "UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?",
                    author);
            detail(id).andExpect(status().isOk());
            list().andExpect(jsonPath("$.data.totalElements").value(2));
        }
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", other);
        request("/options").andExpect(jsonPath("$.data.topics.totalElements").value(1));
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        request("/options")
                .andExpect(jsonPath("$.data.topics.totalElements").value(0))
                .andExpect(jsonPath("$.data.tags.totalElements").value(0));
        assertThat(historyCount()).isEqualTo(history);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT publication_status FROM techverse.articles WHERE id=?",
                                String.class,
                                id))
                .isEqualTo("PUBLISHED");
    }

    @Test
    void inactiveTaxonomyDoesNotHidePublishedSnapshot() throws Exception {
        UUID id = published("Historical article", topic, tag);
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        jdbc.update("UPDATE techverse.tags SET is_active=false WHERE id=?", tag);
        list().andExpect(jsonPath("$.data.totalElements").value(1));
        detail(id).andExpect(status().isOk()).andExpect(jsonPath("$.data.tags[0].id").value(tag.toString()));
        request("/options").andExpect(jsonPath("$.data.topics.totalElements").value(1));
    }

    @Test
    void combinedFiltersAndLiteralSearch() throws Exception {
        UUID frontend = taxonomy("topics", "Frontend");
        UUID id = published("Java 100%_safe\\path", topic, tag);
        published("Java 100xyzsafeXpath", topic, tag);
        published("Java 100%_safe\\path", frontend, tag);
        published("Java 100%_safe\\path", topic);
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(token))
                                .param("keyword", "  JAVA 100%_SAFE\\PATH  ")
                                .param("topicId", topic.toString())
                                .param("tagId", tag.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(id.toString()));
        for (String param : List.of("tagId", "topicId"))
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", bearer(token))
                                    .param(param, UUID.randomUUID().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content").isEmpty());
    }

    @Test
    void newestAndOldestSortWithStablePagination() throws Exception {
        UUID extra = taxonomy("tags", "Spring", true);
        UUID older = published("Older", topic, tag, extra);
        UUID newer = published("Newer", topic, tag, extra);
        setPublishedAt(older, "2020-01-01T00:00:00Z");
        setPublishedAt(newer, "2021-01-01T00:00:00Z");
        list().andExpect(jsonPath("$.data.content[0].id").value(newer.toString()))
                .andExpect(jsonPath("$.data.content[0].tags.length()").value(2));
        for (var sort : Map.of("NEWEST", newer, "OLDEST", older).entrySet())
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", bearer(token))
                                    .param("size", "1")
                                    .param("sort", sort.getKey()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalElements").value(2))
                    .andExpect(jsonPath("$.data.totalPages").value(2))
                    .andExpect(jsonPath("$.data.hasNext").value(true))
                    .andExpect(jsonPath("$.data.content[0].id").value(sort.getValue().toString()));
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(token))
                                .param("page", "99")
                                .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isEmpty())
                .andExpect(jsonPath("$.data.totalElements").value(2));
    }

    @Test
    void invalidFiltersAreBadRequests() throws Exception {
        for (var param :
                Map.of(
                                "page", "-1",
                                "size", "0",
                                "topicId", "bad",
                                "tagId", "bad",
                                "sort", "TITLE",
                                "keyword", "x".repeat(256))
                        .entrySet())
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", bearer(token))
                                    .param(param.getKey(), param.getValue()))
                    .andExpect(status().isBadRequest());
        mvc.perform(get(ROOT).header("Authorization", bearer(token)).param("size", "101"))
                .andExpect(status().isBadRequest());
        request("/not-a-uuid").andExpect(status().isBadRequest());
        for (var param :
                Map.of(
                                "topicPage", "-1",
                                "topicSize", "101",
                                "tagSize", "0",
                                "tagKeyword", "x".repeat(101))
                        .entrySet())
            mvc.perform(
                            get(ROOT + "/options")
                                    .header("Authorization", bearer(token))
                                    .param(param.getKey(), param.getValue()))
                    .andExpect(status().isBadRequest());
    }

    @Test
    void optionsUseOnlyVisibleSnapshotsAndIndependentPagination() throws Exception {
        UUID archived = taxonomy("topics", "Archived");
        UUID oldTag = taxonomy("tags", "Old tag");
        published("Old article", archived, oldTag);
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", archived);
        jdbc.update("UPDATE techverse.tags SET is_active=false WHERE id=?", oldTag);
        published("Current article", topic, tag);
        published("Another current article", topic, tag);
        create("SAVE", "Private", taxonomy("topics", "Draft only"), taxonomy("tags", "Draft tag"));
        create("SUBMIT", "Pending", taxonomy("topics", "Pending only"), taxonomy("tags", "Pending tag"));
        UUID hidden = published("Hidden", taxonomy("topics", "Hidden only"), taxonomy("tags", "Hidden tag"));
        modPublication(hidden, "HIDE", "Spam");
        taxonomy("topics", "Unused");
        request("/options")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.totalElements").value(2))
                .andExpect(jsonPath("$.data.tags.totalElements").value(2));
        mvc.perform(
                        get(ROOT + "/options")
                                .header("Authorization", bearer(token))
                                .param("topicKeyword", "  ARCH  ")
                                .param("tagKeyword", "old")
                                .param("topicSize", "1")
                                .param("tagPage", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.content[0].id").value(archived.toString()))
                .andExpect(jsonPath("$.data.tags.content").isEmpty())
                .andExpect(jsonPath("$.data.tags.totalElements").value(1));
    }

    @Test
    void relatedUsesSameTopicOrSharedTagNewestFirstAndCapsAtFive() throws Exception {
        UUID otherTopic = taxonomy("topics", "Other");
        UUID otherTag = taxonomy("tags", "Other tag");
        UUID source = published("Source", topic, tag);
        List<UUID> expected = new ArrayList<>();
        for (int i = 0; i < 3; i++) expected.add(published("Same topic " + i, topic, otherTag));
        for (int i = 0; i < 3; i++) expected.add(published("Shared tag " + i, otherTopic, tag));
        UUID unrelated = published("Unrelated", otherTopic, otherTag);
        UUID hidden = published("Hidden related", topic, tag);
        modPublication(hidden, "HIDE", "Spam");
        create("SUBMIT", "Pending related", topic, tag);
        for (int i = 0; i < expected.size(); i++)
            setPublishedAt(expected.get(i), "202" + i + "-01-01T00:00:00Z");
        setPublishedAt(unrelated, "2030-01-01T00:00:00Z");
        setPublishedAt(hidden, "2030-01-01T00:00:00Z");
        Collections.reverse(expected);
        var related = json(detail(source).andExpect(status().isOk())).at("/data/relatedArticles");
        List<String> ids = new ArrayList<>();
        related.forEach(row -> ids.add(row.get("id").asText()));
        assertThat(ids)
                .containsExactlyElementsOf(
                        expected.subList(0, 5).stream().map(UUID::toString).toList());
        assertThat(related.get(0).has("content")).isFalse();
        assertThat(related.get(0).get("title").asText()).isEqualTo("Shared tag 2");
        assertThat(related.get(0).get("publishedAt").asText()).isNotBlank();
    }

    @Test
    void readsAreReadOnlyAndQueryCountDoesNotGrowWithRowsTagsOrRelated() throws Exception {
        UUID spring = taxonomy("tags", "Spring");
        UUID source = published("First", topic, tag);
        var before =
                jdbc.queryForMap(
                        "SELECT updated_at,updated_by FROM techverse.articles WHERE id=?", source);
        var stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        list().andExpect(status().isOk());
        long listQueries = stats.getPrepareStatementCount();
        stats.clear();
        detail(source).andExpect(status().isOk());
        long detailQueries = stats.getPrepareStatementCount();
        for (int i = 0; i < 8; i++) published("Article " + i, topic, tag, spring);
        stats.clear();
        list().andExpect(status().isOk()).andExpect(jsonPath("$.data.content.length()").value(9));
        assertThat(stats.getEntityStatistics(Article.class.getName()).getLoadCount()).isZero();
        assertThat(stats.getPrepareStatementCount()).isEqualTo(listQueries);
        stats.clear();
        detail(source).andExpect(jsonPath("$.data.relatedArticles.length()").value(5));
        assertThat(stats.getEntityStatistics(Article.class.getName()).getLoadCount()).isZero();
        assertThat(stats.getPrepareStatementCount()).isEqualTo(detailQueries);
        request("/options").andExpect(status().isOk());
        assertThat(
                        jdbc.queryForMap(
                                "SELECT updated_at,updated_by FROM techverse.articles WHERE id=?",
                                source))
                .isEqualTo(before);
        assertThat(stats.getEntityUpdateCount()).isZero();
    }

    @Test
    void loggedOutAccessTokenCannotRead() throws Exception {
        mvc.perform(post("/api/v1/auth/logout-all").header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        for (String suffix : List.of("", "/options", "/" + UUID.randomUUID()))
            request(suffix).andExpect(status().isUnauthorized());
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
        return taxonomy(table, name, true);
    }

    private UUID taxonomy(String table, String name, boolean active) {
        return jdbc.queryForObject(
                "INSERT INTO techverse." + table + "(name,is_active) VALUES (?,?) RETURNING id",
                UUID.class,
                name,
                active);
    }

    private UUID create(String action, String title, UUID selectedTopic, UUID... tags)
            throws Exception {
        var body =
                Map.of(
                        "action", action,
                        "title", title,
                        "topicId", selectedTopic,
                        "tagIds", List.of(tags),
                        "summary", "Summary",
                        "content", CONTENT);
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

    private UUID published(String title, UUID selectedTopic, UUID... tags) throws Exception {
        UUID id = create("SUBMIT", title, selectedTopic, tags);
        approve(id);
        return id;
    }

    private void approve(UUID id) throws Exception {
        review(id, "APPROVE", null);
    }

    private void review(UUID id, String decision, String note) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("decision", decision);
        body.put("reviewToken", reviewToken(id));
        body.put("moderationNote", note);
        mvc.perform(
                        patch(MOD + "/" + id + "/review")
                                .header("Authorization", bearer(modToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(mapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private void modPublication(UUID id, String action, String note) throws Exception {
        mvc.perform(
                        patch(MOD + "/" + id + "/publication")
                                .header("Authorization", bearer(modToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        mapper.writeValueAsString(
                                                Map.of(
                                                        "action", action,
                                                        "reviewToken", reviewToken(id),
                                                        "moderationNote", note))))
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

    private void edit(UUID id, String action, Map<String, Object> fields) throws Exception {
        var body = new HashMap<String, Object>(fields);
        body.put("action", action);
        mvc.perform(
                        patch(AUTHOR + "/" + id)
                                .header("Authorization", bearer(authorToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(mapper.writeValueAsString(body)))
                .andExpect(status().isOk());
    }

    private String reviewToken(UUID id) throws Exception {
        return json(mvc.perform(get(MOD + "/" + id).header("Authorization", bearer(modToken))))
                .at("/data/reviewToken")
                .asText();
    }

    /** Reorders fixtures; published_at is mutable article metadata, snapshots stay untouched. */
    private void setPublishedAt(UUID id, String at) {
        jdbc.update(
                "UPDATE techverse.articles SET published_at=?::timestamptz WHERE id=?", at, id);
    }

    private int historyCount() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM techverse.article_moderation_history", Integer.class);
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

    private ResultActions request(String suffix) throws Exception {
        return mvc.perform(get(ROOT + suffix).header("Authorization", bearer(token)));
    }

    private ResultActions list() throws Exception {
        return request("");
    }

    private ResultActions detail(UUID id) throws Exception {
        return request("/" + id);
    }

    private String bearer(String t) {
        return "Bearer " + t;
    }
}
