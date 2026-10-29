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

import tools.jackson.databind.ObjectMapper;

import java.util.*;

@Testcontainers
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PublishedArticleIntegrationTest {
    static final String ROOT = "/api/v1/articles";

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
    String token;

    /** Seed isolated database fixtures and a real learner session, without an AuthorProfile. */
    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute(
                "INSERT INTO techverse.roles(name) VALUES"
                    + " ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        learner = user("reader@example.com");
        author = user("writer@example.com");
        token = login("reader@example.com");
        topic = taxonomy("topics", "Backend", true);
        tag = taxonomy("tags", "Java", true);
    }

    /** Ordinary learners must read all three APIs without author permissions. */
    @Test
    void learnerReadsPublishedContentWithoutPrivateFields() throws Exception {
        UUID id = article("PUBLISHED", "Java guide", topic, tag);
        list().andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].author.id").value(author.toString()))
                .andExpect(jsonPath("$.data.content[0].topic.id").value(topic.toString()))
                .andExpect(jsonPath("$.data.content[0].tags[0].id").value(tag.toString()))
                .andExpect(jsonPath("$.data.content[0].content").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].author.email").doesNotExist());
        detail(id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("# Markdown\n```java\nint i = 1;\n```"))
                .andExpect(jsonPath("$.data.relatedArticles").isEmpty())
                .andExpect(jsonPath("$.data.moderationNote").doesNotExist())
                .andExpect(jsonPath("$.data.reviewedBy").doesNotExist())
                .andExpect(jsonPath("$.data.createdBy").doesNotExist())
                .andExpect(jsonPath("$.data.author.password").doesNotExist());
        request("/options")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.content[0].id").value(topic.toString()));
    }

    /** Reader APIs reject anonymous/malformed tokens and keep unsupported writes forbidden. */
    @Test
    void authenticationAndGetOnlyBoundaries() throws Exception {
        for (String suffix : List.of("", "/options", "/" + UUID.randomUUID())) {
            mvc.perform(get(ROOT + suffix)).andExpect(status().isUnauthorized());
            mvc.perform(get(ROOT + suffix).header("Authorization", "Bearer invalid"))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post(ROOT).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    /** An already-issued JWT must not bypass a newly inactive reader account. */
    @Test
    void inactiveReaderIsForbiddenOnEveryRoute() throws Exception {
        UUID id = article("PUBLISHED", "Visible", topic);
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", learner);
        for (String suffix : List.of("", "/options", "/" + id))
            request(suffix).andExpect(status().isForbidden());
    }

    /** Reading is shared by roles; it must not accidentally require LEARNER or AUTHOR alone. */
    @Test
    void adminModeratorAndAuthorCanRead() throws Exception {
        UUID id = article("PUBLISHED", "Shared", topic);
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

    /** Every nonpublished status looks like not-found, including an owner's/admin's draft. */
    @Test
    void onlyPublishedArticlesAreVisibleEvenWithStatusParameter() throws Exception {
        UUID visible = article("PUBLISHED", "Visible", topic);
        for (String state : List.of("DRAFT", "PENDING", "CHANGES_REQUESTED", "HIDDEN", "REMOVED"))
            detail(article(state, state, topic, tag))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("ARTICLE_NOT_FOUND"));
        mvc.perform(get(ROOT).header("Authorization", "Bearer " + token).param("status", "DRAFT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(visible.toString()));
        detail(UUID.randomUUID()).andExpect(status().isNotFound());
        jdbc.update("UPDATE techverse.articles SET status='HIDDEN' WHERE id=?", visible);
        detail(visible).andExpect(status().isNotFound());
    }

    /** Search treats wildcards literally and combines title/topic/tag with AND. */
    @Test
    void combinedFiltersAndLiteralSearch() throws Exception {
        UUID id = article("PUBLISHED", "Java 100%_safe\\path", topic, tag);
        article("PUBLISHED", "Java 100xyzsafeXpath", topic, tag);
        article("PUBLISHED", "Java 100%_safe\\path", taxonomy("topics", "Frontend", true), tag);
        article("PUBLISHED", "Java 100%_safe\\path", topic);
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", "Bearer " + token)
                                .param("keyword", "  JAVA 100%_SAFE\\PATH  ")
                                .param("topicId", topic.toString())
                                .param("tagId", tag.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(id.toString()));
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", "Bearer " + token)
                                .param("tagId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isEmpty());
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", "Bearer " + token)
                                .param("topicId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isEmpty());
    }

    /** Collection cardinality must not inflate counts or break page boundaries. */
    @Test
    void paginationCountsAndStableSort() throws Exception {
        UUID extra = taxonomy("tags", "Spring", true);
        UUID a = article("PUBLISHED", "A", topic, tag, extra);
        UUID b = article("PUBLISHED", "B", topic, tag, extra);
        for (String sort : List.of("PUBLISHED_AT", "UPDATED_AT", "TITLE")) {
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", "Bearer " + token)
                                    .param("size", "1")
                                    .param("sortBy", sort)
                                    .param("direction", "ASC"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalElements").value(2))
                    .andExpect(jsonPath("$.data.totalPages").value(2))
                    .andExpect(jsonPath("$.data.hasNext").value(true));
        }
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", "Bearer " + token)
                                .param("sortBy", "TITLE")
                                .param("direction", "ASC"))
                .andExpect(jsonPath("$.data.content[0].id").value(a.toString()))
                .andExpect(jsonPath("$.data.content[1].id").value(b.toString()));
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", "Bearer " + token)
                                .param("page", "99")
                                .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").isEmpty())
                .andExpect(jsonPath("$.data.totalElements").value(2));
    }

    /** Invalid identifiers, pagination, search lengths and nonallowlisted sorting return400. */
    @Test
    void invalidFiltersAreBadRequests() throws Exception {
        for (var param :
                Map.of(
                                "page",
                                "-1",
                                "size",
                                "0",
                                "topicId",
                                "bad",
                                "tagId",
                                "bad",
                                "sortBy",
                                "CONTENT",
                                "direction",
                                "sideways",
                                "keyword",
                                "x".repeat(256))
                        .entrySet())
            mvc.perform(
                            get(ROOT)
                                    .header("Authorization", "Bearer " + token)
                                    .param(param.getKey(), param.getValue()))
                    .andExpect(status().isBadRequest());
        mvc.perform(get(ROOT).header("Authorization", "Bearer " + token).param("size", "101"))
                .andExpect(status().isBadRequest());
        request("/not-a-uuid").andExpect(status().isBadRequest());
        for (var param :
                Map.of(
                                "topicPage",
                                "-1",
                                "topicSize",
                                "101",
                                "tagSize",
                                "0",
                                "tagKeyword",
                                "x".repeat(101))
                        .entrySet())
            mvc.perform(
                            get(ROOT + "/options")
                                    .header("Authorization", "Bearer " + token)
                                    .param(param.getKey(), param.getValue()))
                    .andExpect(status().isBadRequest());
    }

    /** Published-used taxonomy is available even if inactive, never draft-only/unused entries. */
    @Test
    void optionsUseOnlyPublishedAssociationsAndIndependentPagination() throws Exception {
        UUID oldTopic = taxonomy("topics", "Archived", false);
        UUID oldTag = taxonomy("tags", "Old tag", false);
        article("PUBLISHED", "Old article", oldTopic, oldTag);
        article("PUBLISHED", "Current article", topic, tag);
        article("PUBLISHED", "Another current article", topic, tag);
        article(
                "DRAFT",
                "Private",
                taxonomy("topics", "Draft only", true),
                taxonomy("tags", "Draft tag", true));
        taxonomy("topics", "Unused", true);
        request("/options")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.totalElements").value(2))
                .andExpect(jsonPath("$.data.tags.totalElements").value(2));
        mvc.perform(
                        get(ROOT + "/options")
                                .header("Authorization", "Bearer " + token)
                                .param("topicKeyword", "  ARCH  ")
                                .param("tagKeyword", "old")
                                .param("topicSize", "1")
                                .param("tagPage", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.content[0].id").value(oldTopic.toString()))
                .andExpect(jsonPath("$.data.tags.content").isEmpty())
                .andExpect(jsonPath("$.data.tags.totalElements").value(1));
    }

    /**
     * Inactive taxonomy or a locked/suspended author must not implicitly hide published content.
     */
    @Test
    void publicationDoesNotDependOnCurrentAuthorOrTaxonomyEligibility() throws Exception {
        UUID id = article("PUBLISHED", "Historical article", topic, tag);
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", author);
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        jdbc.update("UPDATE techverse.tags SET is_active=false WHERE id=?", tag);
        list().andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        detail(id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tags[0].id").value(tag.toString()));
    }

    /** Related articles rank exact shared-tag counts first, use newest next, and cap at six. */
    @Test
    void relatedRankingHasNoDuplicatesAndIsBounded() throws Exception {
        UUID spring = taxonomy("tags", "Spring", true);
        UUID source = article("PUBLISHED", "Source", topic, tag, spring);
        UUID strongest = article("PUBLISHED", "Two shared", topic, tag, spring);
        UUID second = article("PUBLISHED", "One shared", topic, tag);
        jdbc.update(
                "UPDATE techverse.articles SET published_at='2020-01-01T00:00:00Z' WHERE id=?",
                strongest);
        jdbc.update(
                "UPDATE techverse.articles SET published_at='2021-01-01T00:00:00Z' WHERE id=?",
                second);
        for (int i = 0; i < 9; i++) article("PUBLISHED", "Unmatched " + i, topic);
        article("PUBLISHED", "Wrong topic", taxonomy("topics", "Other", true), tag, spring);
        article("PENDING", "Pending", topic, tag, spring);
        article("HIDDEN", "Hidden", topic, tag, spring);
        var result =
                detail(source)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.relatedArticles.length()").value(6))
                        .andExpect(
                                jsonPath("$.data.relatedArticles[0].id")
                                        .value(strongest.toString()))
                        .andExpect(
                                jsonPath("$.data.relatedArticles[1].id").value(second.toString()))
                        .andExpect(jsonPath("$.data.relatedArticles[0].content").doesNotExist())
                        .andReturn();
        var related =
                mapper.readTree(result.getResponse().getContentAsString())
                        .at("/data/relatedArticles");
        Set<String> ids = new HashSet<>();
        related.forEach(row -> ids.add(row.get("id").asText()));
        assertThat(ids).hasSize(6).doesNotContain(source.toString());
    }

    /** A tagless source uses same-topic publication order without unrelated fallback. */
    @Test
    void relatedWithoutTagsReturnsNewestSameTopicAndCanBeEmpty() throws Exception {
        UUID source = article("PUBLISHED", "Source", topic);
        UUID older = article("PUBLISHED", "Older", topic, tag);
        UUID newer = article("PUBLISHED", "Newer", topic);
        jdbc.update(
                "UPDATE techverse.articles SET published_at='2020-01-01T00:00:00Z' WHERE id=?",
                older);
        detail(source)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.relatedArticles.length()").value(2))
                .andExpect(jsonPath("$.data.relatedArticles[0].id").value(newer.toString()));
        jdbc.update(
                "UPDATE techverse.articles SET status='HIDDEN' WHERE id IN (?,?)", older, newer);
        article("PUBLISHED", "Different topic", taxonomy("topics", "Other", true));
        detail(source)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.relatedArticles").isEmpty());
    }

    /**
     * GETs must not dirty audit state or hydrate full Article entities for list/related queries.
     */
    @Test
    void readsAreReadOnlyAndListDoesNotHydrateArticlesOrNPlusOne() throws Exception {
        UUID source = article("PUBLISHED", "First", topic, tag);
        var before =
                jdbc.queryForMap(
                        "SELECT updated_at,updated_by FROM techverse.articles WHERE id=?", source);
        var stats = emf.unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        list().andExpect(status().isOk());
        long singleQueries = stats.getPrepareStatementCount();
        for (int i = 0; i < 15; i++) article("PUBLISHED", "Article " + i, topic, tag);
        stats.clear();
        list().andExpect(status().isOk()).andExpect(jsonPath("$.data.content.length()").value(16));
        assertThat(stats.getEntityStatistics(Article.class.getName()).getLoadCount()).isZero();
        assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(singleQueries + 1);
        detail(source).andExpect(status().isOk());
        request("/options").andExpect(status().isOk());
        assertThat(
                        jdbc.queryForMap(
                                "SELECT updated_at,updated_by FROM techverse.articles WHERE id=?",
                                source))
                .isEqualTo(before);
        assertThat(stats.getEntityUpdateCount()).isZero();
    }

    /** Logout must make an existing access token unusable for reading. */
    @Test
    void loggedOutAccessTokenCannotRead() throws Exception {
        mvc.perform(post("/api/v1/auth/logout-all").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        for (String suffix : List.of("", "/options", "/" + UUID.randomUUID()))
            request(suffix).andExpect(status().isUnauthorized());
    }

    /** Create a local account using the existing registration entity defaults. */
    private UUID user(String email) {
        return users.saveAndFlush(
                        User.createLocalAccount(
                                "Test reader", email, encoder.encode("SecurePass123!")))
                .getId();
    }

    /** Create known taxonomy fixtures; table is restricted to test-owned literals. */
    private UUID taxonomy(String table, String name, boolean active) {
        return jdbc.queryForObject(
                "INSERT INTO techverse." + table + "(name,is_active) VALUES (?,?) RETURNING id",
                UUID.class,
                name,
                active);
    }

    /**
     * Seed content in a requested lifecycle state without Cloudinary or moderation side effects.
     */
    private UUID article(String state, String title, UUID selectedTopic, UUID... tags) {
        UUID id =
                jdbc.queryForObject(
                        "INSERT INTO"
                            + " techverse.articles(author_id,topic_id,title,summary,content,status,published_at)"
                            + " VALUES (?,?,?,'Summary',?,?,CASE WHEN ?='PUBLISHED' THEN now() ELSE"
                            + " NULL END) RETURNING id",
                        UUID.class,
                        author,
                        selectedTopic,
                        title,
                        "# Markdown\n```java\nint i = 1;\n```",
                        state,
                        state);
        for (UUID selectedTag : tags)
            jdbc.update(
                    "INSERT INTO techverse.article_tags(article_id,tag_id) VALUES (?,?)",
                    id,
                    selectedTag);
        return id;
    }

    /** Obtain a production JWT/session pair through the actual password login endpoint. */
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

    /** Call an authenticated reader route using the current fixture token. */
    private ResultActions request(String suffix) throws Exception {
        return mvc.perform(get(ROOT + suffix).header("Authorization", "Bearer " + token));
    }

    /** Request the default public-content list as the authenticated learner. */
    private ResultActions list() throws Exception {
        return request("");
    }

    /** Request a single article through the reader visibility boundary. */
    private ResultActions detail(UUID id) throws Exception {
        return request("/" + id);
    }
}
