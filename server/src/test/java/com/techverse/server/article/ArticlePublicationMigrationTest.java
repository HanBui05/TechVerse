package com.techverse.server.article;

import static org.assertj.core.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

/** Plain Flyway against a real PostgreSQL: no Spring context, so it stays fast. */
@Testcontainers
class ArticlePublicationMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    static JdbcTemplate jdbc;
    static String hex = "a".repeat(64);
    UUID author, topic, tag;

    @BeforeAll
    static void migrateClean() {
        flyway(postgres.getJdbcUrl(), null).migrate();
        jdbc = new JdbcTemplate(dataSource(postgres.getJdbcUrl()));
    }

    @BeforeEach
    void seed() {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        author = insertUser(jdbc);
        topic = jdbc.queryForObject("INSERT INTO topics(name) VALUES ('Backend') RETURNING id", UUID.class);
        tag = jdbc.queryForObject("INSERT INTO tags(name) VALUES ('Java') RETURNING id", UUID.class);
    }

    @Test
    void appliesV10AndAddsSavedListIndex() {
        assertThat(jdbc.queryForObject(
                        "SELECT max(version::int) FROM flyway_schema_history WHERE success", Integer.class))
                .isEqualTo(10);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM pg_indexes WHERE schemaname='techverse'"
                                + " AND indexname='idx_saved_articles_user_created'",
                        Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM information_schema.columns WHERE table_schema='techverse'"
                                + " AND table_name='articles' AND column_name='status'",
                        Integer.class))
                .isZero();
    }

    @Test
    void newArticleDefaultsToUnpublishedDraft() {
        UUID id = article("UNPUBLISHED", "DRAFT", null, null);
        assertThat(jdbc.queryForMap(
                        "SELECT workflow_status, publication_status FROM articles WHERE id=?", id))
                .containsEntry("workflow_status", "DRAFT")
                .containsEntry("publication_status", "UNPUBLISHED");
    }

    @Test
    void rejectsInconsistentStates() {
        assertThatThrownBy(() -> article("PUBLISHED", "PUBLISHED", null, null))
                .hasMessageContaining("ck_articles_");
        assertThatThrownBy(() -> article("UNPUBLISHED", "PUBLISHED", null, null))
                .hasMessageContaining("ck_articles_");
        assertThatThrownBy(() -> article("UNPUBLISHED", "ARCHIVED", null, null))
                .hasMessageContaining("ck_articles_");
        assertThatThrownBy(() -> article("UNPUBLISHED", "DRAFT", "PUBLISHED", null))
                .hasMessageContaining("ck_articles_");

        UUID id = article("UNPUBLISHED", "PENDING", null, null);
        UUID version = version(id, 1);
        publish(id, version);
        assertThatThrownBy(() -> jdbc.update(
                        "UPDATE articles SET publication_status='HIDDEN' WHERE id=?", id))
                .hasMessageContaining("ck_articles_hidden_source");
        assertThatThrownBy(() -> jdbc.update(
                        "UPDATE articles SET publication_status='HIDDEN',"
                                + " hidden_from_publication_status='REMOVED' WHERE id=?",
                        id))
                .hasMessageContaining("ck_articles_hidden_source");
        jdbc.update(
                "UPDATE articles SET publication_status='HIDDEN',"
                        + " hidden_from_publication_status='AUTHOR_HIDDEN' WHERE id=?",
                id);
    }

    @Test
    void versionPointerMustBelongToSameArticle() {
        UUID first = article("UNPUBLISHED", "PENDING", null, null);
        UUID second = article("UNPUBLISHED", "PENDING", null, null);
        UUID foreign = version(second, 1);
        assertThatThrownBy(() -> publish(first, foreign)).hasMessageContaining("fk_articles_published_version");
    }

    @Test
    void snapshotsAndHistoryAreAppendOnly() {
        UUID id = article("UNPUBLISHED", "PENDING", null, null);
        UUID version = version(id, 1);
        jdbc.update("INSERT INTO article_publication_version_tags(version_id, tag_id) VALUES (?,?)", version, tag);
        publish(id, version);
        assertThatThrownBy(() -> version(id, 1)).hasMessageContaining("uq_article_publication_versions_number");
        assertThatThrownBy(() -> jdbc.update(
                        "UPDATE article_publication_versions SET title='Changed' WHERE id=?", version))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM article_publication_version_tags WHERE version_id=?", version))
                .hasMessageContaining("append-only");
        UUID history = jdbc.queryForObject(
                "INSERT INTO article_moderation_history(article_id, actor_id, action, from_workflow_status,"
                        + " to_workflow_status, from_publication_status, to_publication_status, version_id)"
                        + " VALUES (?,?,'APPROVE','PENDING','PUBLISHED','UNPUBLISHED','PUBLISHED',?) RETURNING id",
                UUID.class, id, author, version);
        assertThatThrownBy(() -> jdbc.update(
                        "UPDATE article_moderation_history SET note='x' WHERE id=?", history))
                .hasMessageContaining("append-only");
        // A published article can never be hard-deleted: its snapshot RESTRICTs the delete.
        assertThatThrownBy(() -> jdbc.update("DELETE FROM articles WHERE id=?", id))
                .hasMessageContaining("violates foreign key");
    }

    @Test
    void neverPublishedArticleHardDeleteCascadesItsHistory() {
        UUID id = article("UNPUBLISHED", "CHANGES_REQUESTED", null, null);
        jdbc.update(
                "INSERT INTO article_moderation_history(article_id, actor_id, action, note, from_workflow_status,"
                        + " to_workflow_status, from_publication_status, to_publication_status)"
                        + " VALUES (?,?,'REQUEST_CHANGES','Fix','PENDING','CHANGES_REQUESTED','UNPUBLISHED','UNPUBLISHED')",
                id, author);
        jdbc.update("DELETE FROM articles WHERE id=?", id);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM article_moderation_history", Integer.class)).isZero();
    }

    @Test
    void v10FailsClearlyWhenArticlesAlreadyHaveRows() {
        new JdbcTemplate(dataSource(postgres.getJdbcUrl())).execute("CREATE DATABASE legacy");
        String url = postgres.getJdbcUrl().replaceFirst("/[^/?]+(\\?|$)", "/legacy$1");
        flyway(url, "9").migrate();
        var legacy = new JdbcTemplate(dataSource(url));
        UUID user = insertUser(legacy);
        UUID legacyTopic = legacy.queryForObject("INSERT INTO topics(name) VALUES ('Old') RETURNING id", UUID.class);
        legacy.update(
                "INSERT INTO articles(author_id, topic_id, title, summary, content) VALUES (?,?,'Old','','')",
                user, legacyTopic);
        assertThatThrownBy(() -> flyway(url, null).migrate())
                .hasStackTraceContaining("V10 requires an empty articles table");
    }

    private UUID article(String publication, String workflow, String hiddenFrom, UUID version) {
        return jdbc.queryForObject(
                "INSERT INTO articles(author_id, topic_id, title, summary, content, content_fingerprint,"
                        + " publication_status, workflow_status, hidden_from_publication_status, published_version_id)"
                        + " VALUES (?,?,'T','','',?,?,?,?,?) RETURNING id",
                UUID.class, author, topic, hex, publication, workflow, hiddenFrom, version);
    }

    private UUID version(UUID article, int number) {
        return jdbc.queryForObject(
                "INSERT INTO article_publication_versions(article_id, version_number, title, summary, content,"
                        + " topic_id, content_fingerprint, reading_minutes, approved_by, approved_at)"
                        + " VALUES (?,?,'T','S','C',?,?,1,?,now()) RETURNING id",
                UUID.class, article, number, topic, hex, author);
    }

    private void publish(UUID article, UUID version) {
        jdbc.update(
                "UPDATE articles SET published_version_id=?, publication_status='PUBLISHED',"
                        + " workflow_status='PUBLISHED', published_at=now() WHERE id=?",
                version, article);
    }

    private static UUID insertUser(JdbcTemplate t) {
        return t.queryForObject(
                "INSERT INTO users(full_name, email) VALUES ('Author', ?) RETURNING id",
                UUID.class, UUID.randomUUID() + "@example.com");
    }

    private static Flyway flyway(String url, String target) {
        var config = Flyway.configure()
                .dataSource(url, postgres.getUsername(), postgres.getPassword())
                .schemas("techverse")
                .defaultSchema("techverse")
                .createSchemas(true)
                .locations("classpath:db/migration");
        if (target != null) config.target(target);
        return config.load();
    }

    private static DriverManagerDataSource dataSource(String url) {
        String scoped = url + (url.contains("?") ? "&" : "?") + "currentSchema=techverse,public";
        return new DriverManagerDataSource(scoped, postgres.getUsername(), postgres.getPassword());
    }
}
