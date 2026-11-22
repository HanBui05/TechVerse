package com.techverse.server.messaging;

import static org.assertj.core.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

/** Plain Flyway against a real empty PostgreSQL: no Spring context. */
@Testcontainers
class MessagingMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    static JdbcTemplate jdbc() {
        String url = postgres.getJdbcUrl();
        return new JdbcTemplate(new DriverManagerDataSource(
                url + (url.contains("?") ? "&" : "?") + "currentSchema=techverse,public", postgres.getUsername(), postgres.getPassword()));
    }

    @Test
    void createsConversationsMessagesAndConversationReports() {
        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas("techverse").defaultSchema("techverse").createSchemas(true)
                .locations("classpath:db/migration").load().migrate();
        var jdbc = jdbc();
        UUID learner = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('L','l@example.com') RETURNING id", UUID.class);
        UUID author = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('A','a@example.com') RETURNING id", UUID.class);
        UUID other = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('O','o@example.com') RETURNING id", UUID.class);
        UUID topic = jdbc.queryForObject("INSERT INTO topics(name) VALUES ('T') RETURNING id", UUID.class);
        UUID course = jdbc.queryForObject("INSERT INTO courses(author_id, topic_id, title, summary, description, level, content_fingerprint)"
                + " VALUES (?,?,'C','S','D','BEGINNER',repeat('a',64)) RETURNING id", UUID.class, author, topic);

        String open = "INSERT INTO conversations(learner_id, author_id, context_course_id, context_course_title) VALUES (?,?,?,'C') RETURNING id";
        UUID c = jdbc.queryForObject(open, UUID.class, learner, author, course);
        var row = jdbc.queryForMap("SELECT author_replied, learner_last_read_seq, author_last_read_seq, last_message_seq FROM conversations WHERE id=?", c);
        assertThat(row).containsEntry("author_replied", false).containsEntry("learner_last_read_seq", 0L)
                .containsEntry("author_last_read_seq", 0L).containsEntry("last_message_seq", null);
        assertThatThrownBy(() -> jdbc.queryForObject(open, UUID.class, learner, author, course)).hasMessageContaining("uq_conversations_pair");
        assertThatThrownBy(() -> jdbc.queryForObject(open, UUID.class, author, author, course)).hasMessageContaining("ck_conversations_participants");
        UUID reverse = jdbc.queryForObject(open, UUID.class, author, learner, course);

        // Messages: seq grows, client ids are unique per sender across all conversations, content not blank.
        String send = "INSERT INTO messages(conversation_id, sender_id, content, client_id) VALUES (?,?,?,?) RETURNING seq";
        UUID clientId = UUID.randomUUID();
        long s1 = jdbc.queryForObject(send, Long.class, c, learner, "Hi", clientId);
        long s2 = jdbc.queryForObject(send, Long.class, c, author, "Hello", clientId);
        assertThat(s2).isGreaterThan(s1);
        assertThatThrownBy(() -> jdbc.queryForObject(send, Long.class, reverse, learner, "Again", clientId)).hasMessageContaining("uq_messages_sender_client");
        assertThatThrownBy(() -> jdbc.queryForObject(send, Long.class, c, learner, "  ", UUID.randomUUID())).hasMessageContaining("ck_messages_content");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM conversations WHERE id=?", c)).hasMessageContaining("messages");

        // Deleting the context course keeps the conversation and its stored title.
        jdbc.update("DELETE FROM courses WHERE id=?", course);
        assertThat(jdbc.queryForMap("SELECT context_course_id, context_course_title FROM conversations WHERE id=?", c))
                .containsEntry("context_course_id", null).containsEntry("context_course_title", "C");

        // Reports: CONVERSATION targets are checked by the trigger; the old types still work.
        String report = "INSERT INTO reports(reporter_id, target_type, target_id, reason) VALUES (?,?,?,'SPAM')";
        assertThat(jdbc.update(report, learner, "CONVERSATION", c)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update(report, other, "CONVERSATION", UUID.randomUUID())).hasMessageContaining("Report target does not exist");
        UUID post = jdbc.queryForObject("INSERT INTO forum_posts(user_id, topic_id, title, content) VALUES (?,?,'Q','Body') RETURNING id", UUID.class, other, topic);
        assertThat(jdbc.update(report, learner, "FORUM_POST", post)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update(report, other, "FORUM_POST", UUID.randomUUID())).hasMessageContaining("Report target does not exist");

        assertThat(jdbc.queryForList("SELECT indexdef FROM pg_indexes WHERE indexname IN"
                        + " ('idx_conversations_learner_last','idx_conversations_author_last','uq_messages_conversation_seq')", String.class))
                .anyMatch(d -> d.contains("(learner_id, last_message_at DESC)"))
                .anyMatch(d -> d.contains("(author_id, last_message_at DESC)"))
                .anyMatch(d -> d.contains("(conversation_id, seq)"));
    }
}
