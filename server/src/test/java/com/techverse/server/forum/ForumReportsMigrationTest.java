package com.techverse.server.forum;

import static org.assertj.core.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

/** Plain Flyway against a real empty PostgreSQL: no Spring context. */
@Testcontainers
class ForumReportsMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    static Flyway flyway(String target) {
        return Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas("techverse").defaultSchema("techverse").createSchemas(true)
                .locations("classpath:db/migration").target(target).load();
    }

    static JdbcTemplate jdbc() {
        String url = postgres.getJdbcUrl();
        return new JdbcTemplate(new DriverManagerDataSource(
                url + (url.contains("?") ? "&" : "?") + "currentSchema=techverse,public", postgres.getUsername(), postgres.getPassword()));
    }

    @Test
    void addsForumColumnsChecksIndexesAndStopsWhenTablesHoldData() {
        flyway("20").migrate();
        var jdbc = jdbc();
        UUID user = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('A','a@example.com') RETURNING id", UUID.class);
        UUID topic = jdbc.queryForObject("INSERT INTO topics(name) VALUES ('T') RETURNING id", UUID.class);

        // Existing forum post or report: the migration must refuse (no backfill).
        UUID old = jdbc.queryForObject("INSERT INTO forum_posts(user_id, title, content) VALUES (?, 'Old question', 'Body') RETURNING id", UUID.class, user);
        assertThatThrownBy(() -> flyway("latest").migrate()).hasMessageContaining("forum_posts");
        UUID reporter = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('R','r@example.com') RETURNING id", UUID.class);
        jdbc.update("INSERT INTO reports(reporter_id, target_type, target_id, reason) VALUES (?, 'FORUM_POST', ?, 'SPAM')", reporter, old);
        jdbc.update("DELETE FROM forum_posts");
        assertThatThrownBy(() -> flyway("latest").migrate()).hasMessageContaining("reports");
        jdbc.update("DELETE FROM reports");

        flyway("latest").migrate();

        // A question needs a topic; an answer must not have one.
        assertThatThrownBy(() -> jdbc.update("INSERT INTO forum_posts(user_id, title, content) VALUES (?, 'Q', 'Body')", user))
                .hasMessageContaining("ck_forum_posts_topic");
        UUID q = jdbc.queryForObject("INSERT INTO forum_posts(user_id, topic_id, title, content) VALUES (?,?,'Q','Body') RETURNING id", UUID.class, user, topic);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO forum_posts(user_id, parent_id, topic_id, content) VALUES (?,?,?,'A')", user, q, topic))
                .hasMessageContaining("ck_forum_posts_topic");
        UUID a = jdbc.queryForObject("INSERT INTO forum_posts(user_id, parent_id, content) VALUES (?,?,'Answer') RETURNING id", UUID.class, user, q);

        // Only a question carries an accepted answer; deleting the answer clears the pointer.
        assertThat(jdbc.update("UPDATE forum_posts SET accepted_answer_id=? WHERE id=?", a, q)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("UPDATE forum_posts SET accepted_answer_id=? WHERE id=?", a, a))
                .hasMessageContaining("ck_forum_posts_accepted_answer");
        assertThat(jdbc.update("UPDATE forum_posts SET edited_at=now(), hidden_by=?, hidden_at=now(), moderation_note='n' WHERE id=?", user, a))
                .isEqualTo(1);
        jdbc.update("DELETE FROM forum_posts WHERE id=?", a);
        assertThat(jdbc.queryForMap("SELECT accepted_answer_id FROM forum_posts WHERE id=?", q)).containsEntry("accepted_answer_id", null);

        // A topic in use cannot be deleted.
        assertThatThrownBy(() -> jdbc.update("DELETE FROM topics WHERE id=?", topic)).hasMessageContaining("forum_posts");

        assertThat(jdbc.queryForList("SELECT indexname FROM pg_indexes WHERE indexname IN"
                        + " ('idx_forum_posts_topic_created','idx_forum_posts_user_created','idx_reports_target')", String.class))
                .containsExactlyInAnyOrder("idx_forum_posts_topic_created", "idx_forum_posts_user_created", "idx_reports_target");
        assertThat(jdbc.queryForObject("SELECT indexdef FROM pg_indexes WHERE indexname='idx_forum_posts_topic_created'", String.class))
                .contains("WHERE (parent_id IS NULL)");

        // Reactions: one per user and post, four types, gone with the user or the post.
        UUID fan = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('F','f@example.com') RETURNING id", UUID.class);
        UUID a2 = jdbc.queryForObject("INSERT INTO forum_posts(user_id, parent_id, content) VALUES (?,?,'Answer 2') RETURNING id", UUID.class, user, q);
        jdbc.update("INSERT INTO forum_post_reactions(user_id, post_id, type) VALUES (?,?,'LIKE')", user, q);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO forum_post_reactions(user_id, post_id, type) VALUES (?,?,'HAHA')", user, q))
                .hasMessageContaining("uq_forum_post_reactions_user_post");
        assertThatThrownBy(() -> jdbc.update("INSERT INTO forum_post_reactions(user_id, post_id, type) VALUES (?,?,'WOW')", fan, q))
                .hasMessageContaining("ck_forum_post_reactions_type");
        jdbc.update("INSERT INTO forum_post_reactions(user_id, post_id, type) VALUES (?,?,'HAHA')", fan, a2);
        jdbc.update("INSERT INTO forum_post_reactions(user_id, post_id, type) VALUES (?,?,'LOVE')", fan, q);
        jdbc.update("INSERT INTO forum_post_reactions(user_id, post_id, type) VALUES (?,?,'ANGRY')", user, a2);
        jdbc.update("DELETE FROM forum_posts WHERE id=?", a2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM forum_post_reactions WHERE post_id=?", Integer.class, a2)).isZero();
        jdbc.update("DELETE FROM users WHERE id=?", fan);
        assertThat(jdbc.queryForList("SELECT user_id FROM forum_post_reactions", UUID.class)).containsExactly(user);
        assertThat(jdbc.queryForObject("SELECT indexdef FROM pg_indexes WHERE indexname='idx_forum_post_reactions_post_type'", String.class))
                .contains("(post_id, type, updated_at DESC, id DESC)");
    }
}
