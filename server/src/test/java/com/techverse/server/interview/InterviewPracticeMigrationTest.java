package com.techverse.server.interview;

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
class InterviewPracticeMigrationTest {
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

    static UUID insertQuestion(JdbcTemplate jdbc, UUID author, UUID topic) {
        return jdbc.queryForObject("INSERT INTO interview_questions(author_id, topic_id, level, question, sample_answer)"
                + " VALUES (?,?,'EASY','What is a JVM?','A virtual machine running bytecode.') RETURNING id", UUID.class, author, topic);
    }

    @Test
    void addsStatusColumnsMarksTableAndStopsWhenQuestionsExist() {
        flyway("19").migrate();
        var jdbc = jdbc();
        UUID author = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('A','a@example.com') RETURNING id", UUID.class);
        UUID topic = jdbc.queryForObject("INSERT INTO topics(name) VALUES ('T') RETURNING id", UUID.class);
        insertQuestion(jdbc, author, topic);

        // Existing data: the migration must refuse (no backfill).
        assertThatThrownBy(() -> flyway("latest").migrate()).hasMessageContaining("interview");
        jdbc.update("DELETE FROM interview_questions");

        flyway("latest").migrate();

        UUID q = insertQuestion(jdbc, author, topic);
        assertThat(jdbc.queryForMap("SELECT ai_assisted, version, hidden_from_status FROM interview_questions WHERE id=?", q))
                .containsEntry("ai_assisted", false).containsEntry("version", 0).containsEntry("hidden_from_status", null);
        assertThat(jdbc.update("UPDATE interview_questions SET status='AUTHOR_HIDDEN', published_at=now() WHERE id=?", q)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("UPDATE interview_questions SET status='NOPE' WHERE id=?", q))
                .hasMessageContaining("ck_interview_questions_status");
        // hidden_from_status is set exactly when HIDDEN.
        assertThatThrownBy(() -> jdbc.update("UPDATE interview_questions SET status='HIDDEN' WHERE id=?", q))
                .hasMessageContaining("ck_interview_questions_hidden_from");
        assertThat(jdbc.update("UPDATE interview_questions SET status='HIDDEN', hidden_from_status='AUTHOR_HIDDEN' WHERE id=?", q)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("UPDATE interview_questions SET version=-1 WHERE id=?", q))
                .hasMessageContaining("ck_interview_questions_version");

        // Marks: one row per user and question; both stamps NULL is a valid "unmarked" row; cascades both ways.
        String mark = "INSERT INTO interview_question_marks(user_id, question_id) VALUES (?,?)";
        jdbc.update(mark, author, q);
        assertThatThrownBy(() -> jdbc.update(mark, author, q)).hasMessageContaining("uq_interview_question_marks_user_question");
        assertThat(jdbc.queryForMap("SELECT reviewed_at, saved_at, created_at FROM interview_question_marks WHERE question_id=?", q))
                .containsEntry("reviewed_at", null).containsEntry("saved_at", null).extractingByKey("created_at").isNotNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pg_indexes WHERE indexname='idx_interview_question_marks_user_saved'", Integer.class))
                .isEqualTo(1);
        jdbc.update("DELETE FROM interview_questions WHERE id=?", q);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM interview_question_marks", Integer.class)).isZero();
        UUID q2 = insertQuestion(jdbc, author, topic);
        UUID learner = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('L','l@example.com') RETURNING id", UUID.class);
        jdbc.update(mark, learner, q2);
        jdbc.update("DELETE FROM users WHERE id=?", learner);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM interview_question_marks", Integer.class)).isZero();
    }
}
