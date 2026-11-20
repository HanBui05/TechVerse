package com.techverse.server.exercise;

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
class ExercisePracticeMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    static final String SCHEMA_URL_SUFFIX = "currentSchema=techverse,public";

    static Flyway flyway(String target) {
        return Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas("techverse")
                .defaultSchema("techverse")
                .createSchemas(true)
                .locations("classpath:db/migration")
                .target(target)
                .load();
    }

    static JdbcTemplate jdbc() {
        String url = postgres.getJdbcUrl();
        return new JdbcTemplate(new DriverManagerDataSource(
                url + (url.contains("?") ? "&" : "?") + SCHEMA_URL_SUFFIX, postgres.getUsername(), postgres.getPassword()));
    }

    static UUID insertSet(JdbcTemplate jdbc, UUID author, UUID topic) {
        return jdbc.queryForObject(
                "INSERT INTO exercise_sets(author_id, topic_id, title, description, exercise_type, difficulty)"
                        + " VALUES (?,?,'Title','', 'MULTIPLE_CHOICE','EASY') RETURNING id",
                UUID.class, author, topic);
    }

    @Test
    void addsStatusColumnsConstraintsAndStopsWhenExerciseTablesHaveData() {
        flyway("18").migrate();
        var jdbc = jdbc();
        UUID author = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('A','a@example.com') RETURNING id", UUID.class);
        UUID topic = jdbc.queryForObject("INSERT INTO topics(name) VALUES ('T') RETURNING id", UUID.class);
        insertSet(jdbc, author, topic);

        // Existing data: the migration must refuse (no backfill).
        assertThatThrownBy(() -> flyway("latest").migrate()).hasMessageContaining("exercise");
        jdbc.update("DELETE FROM exercise_sets");

        flyway("latest").migrate();

        UUID set = insertSet(jdbc, author, topic);
        assertThat(jdbc.queryForMap("SELECT ai_assisted, version, hidden_from_status FROM exercise_sets WHERE id=?", set))
                .containsEntry("ai_assisted", false).containsEntry("version", 0).containsEntry("hidden_from_status", null);
        assertThat(jdbc.update("UPDATE exercise_sets SET status='AUTHOR_HIDDEN', published_at=now() WHERE id=?", set)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("UPDATE exercise_sets SET time_limit_seconds=60 WHERE id=?", set))
                .hasMessageContaining("ck_exercise_sets_time_limit");
        assertThatThrownBy(() -> jdbc.update("UPDATE exercise_sets SET version=-1 WHERE id=?", set))
                .hasMessageContaining("ck_exercise_sets_version");

        // Idempotency key is unique per user and mandatory.
        String insert = "INSERT INTO exercise_attempts(user_id, exercise_set_id, attempt_snapshot, idempotency_key)"
                + " VALUES (?,?,'{}'::jsonb,?)";
        UUID key = UUID.randomUUID();
        jdbc.update(insert, author, set, key);
        assertThatThrownBy(() -> jdbc.update(insert, author, set, key)).hasMessageContaining("uq_exercise_attempts_user_key");
        assertThatThrownBy(() -> jdbc.update(
                        "INSERT INTO exercise_attempts(user_id, exercise_set_id, attempt_snapshot) VALUES (?,?,'{}'::jsonb)", author, set))
                .hasMessageContaining("idempotency_key");
    }
}
