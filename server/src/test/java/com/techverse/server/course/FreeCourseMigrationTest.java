package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.UUID;

/** Plain Flyway against a real PostgreSQL: no Spring context, so it stays fast. */
@Testcontainers
class FreeCourseMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    static JdbcTemplate jdbc;
    static final String HEX = "a".repeat(64);
    UUID author, topic, tag, course, chapter;

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
        course = course();
        chapter = chapter(course, 1);
    }

    @Test
    void createsTablesColumnsAndIndexes() {
        for (String table : List.of(
                "course_tags", "course_chapters", "course_publication_versions",
                "course_publication_version_tags", "course_publication_version_chapters",
                "course_publication_version_lessons", "course_moderation_history")) {
            assertThat(count("information_schema.tables", "table_name='" + table + "'"))
                    .as(table).isEqualTo(1);
        }
        for (String column : List.of(
                "lessons.chapter_id", "lessons.summary", "lessons.video_provider", "lessons.video_id",
                "lessons.is_preview", "lessons.content_fingerprint", "lessons.ai_assisted",
                "lessons.archived_at", "course_chapters.archived_at",
                "course_enrollments.last_lesson_id", "course_enrollments.last_accessed_at",
                "courses.workflow_status", "courses.publication_status", "courses.published_version_id")) {
            String[] p = column.split("\\.");
            assertThat(count("information_schema.columns",
                            "table_name='" + p[0] + "' AND column_name='" + p[1] + "'"))
                    .as(column).isEqualTo(1);
        }
        for (String gone : List.of("lessons.video_url", "courses.status")) {
            String[] p = gone.split("\\.");
            assertThat(count("information_schema.columns",
                            "table_name='" + p[0] + "' AND column_name='" + p[1] + "'"))
                    .as(gone).isZero();
        }
        assertThat(count("pg_indexes", "indexname IN ('uq_lessons_active_position',"
                        + "'uq_course_chapters_active_position','idx_courses_public','idx_courses_queue')"))
                .isEqualTo(4);
    }

    @Test
    void courseMustStayFreeAndConsistent() {
        assertThatThrownBy(() -> jdbc.update("UPDATE courses SET price_amount=1000 WHERE id=?", course))
                .hasMessageContaining("ck_courses_free");
        assertThatThrownBy(() -> jdbc.update("UPDATE courses SET publication_status='PUBLISHED' WHERE id=?", course))
                .hasMessageContaining("ck_courses_");
        assertThatThrownBy(() -> jdbc.update("UPDATE courses SET workflow_status='PUBLISHED' WHERE id=?", course))
                .hasMessageContaining("ck_courses_workflow_snapshot");
    }

    @Test
    void lessonNeedsContentOrVideoAndValidProviderPair() {
        assertThatThrownBy(() -> lesson(course, chapter, 1, null, null, null))
                .hasMessageContaining("ck_lessons_content_or_video");
        assertThatThrownBy(() -> lesson(course, chapter, 1, "  ", null, null))
                .hasMessageContaining("ck_lessons_content_or_video");
        assertThatThrownBy(() -> lesson(course, chapter, 1, null, "YOUTUBE", null))
                .hasMessageContaining("ck_lessons_");
        assertThatThrownBy(() -> lesson(course, chapter, 1, null, null, "dQw4w9WgXcQ"))
                .hasMessageContaining("ck_lessons_video");
        assertThatThrownBy(() -> lesson(course, chapter, 1, null, "VIMEO", "dQw4w9WgXcQ"))
                .hasMessageContaining("ck_lessons_video");
        assertThatThrownBy(() -> lesson(course, chapter, 1, null, "YOUTUBE", "short"))
                .hasMessageContaining("ck_lessons_video");
        assertThatThrownBy(() -> lesson(course, chapter, 1, null, "YOUTUBE", "dQw4w9Wg*cQ"))
                .hasMessageContaining("ck_lessons_video");
        lesson(course, chapter, 1, "text", null, null);
        lesson(course, chapter, 2, null, "YOUTUBE", "dQw4w9WgXcQ");
    }

    @Test
    void positionIsUniquePerChapterAmongActiveRowsAndLessonStaysInOwnCourse() {
        UUID first = lesson(course, chapter, 1, "t", null, null);
        assertThatThrownBy(() -> lesson(course, chapter, 1, "t", null, null))
                .hasMessageContaining("uq_lessons_active_position");
        jdbc.update("UPDATE lessons SET archived_at=now() WHERE id=?", first);
        lesson(course, chapter, 1, "t", null, null); // archived row frees the position
        assertThatThrownBy(() -> chapter(course, 1)).hasMessageContaining("uq_course_chapters_active_position");

        UUID other = course();
        assertThatThrownBy(() -> lesson(other, chapter, 9, "t", null, null))
                .hasMessageContaining("fk_lessons_chapter");
    }

    @Test
    void snapshotLessonKeepsStableLessonIdAndSnapshotsAreAppendOnly() {
        UUID lessonId = lesson(course, chapter, 1, "t", null, null);
        UUID version = jdbc.queryForObject(
                "INSERT INTO course_publication_versions(course_id, version_number, title, summary,"
                        + " description, level, topic_id, content_fingerprint, approved_by, approved_at)"
                        + " VALUES (?,1,'T','S','D','BEGINNER',?,?,?,now()) RETURNING id",
                UUID.class, course, topic, HEX, author);
        UUID vChapter = jdbc.queryForObject(
                "INSERT INTO course_publication_version_chapters(version_id, chapter_id, title, position)"
                        + " VALUES (?,?,'Intro',1) RETURNING id", UUID.class, version, chapter);
        UUID vLesson = jdbc.queryForObject(
                "INSERT INTO course_publication_version_lessons(version_id, version_chapter_id, lesson_id,"
                        + " title, content, is_preview, position, content_fingerprint, ai_assisted)"
                        + " VALUES (?,?,?,'L','t',false,1,?,false) RETURNING id",
                UUID.class, version, vChapter, lessonId, HEX);
        jdbc.update("INSERT INTO course_publication_version_tags(version_id, tag_id) VALUES (?,?)", version, tag);
        jdbc.update("UPDATE courses SET workflow_status='PUBLISHED', publication_status='PUBLISHED',"
                + " published_version_id=?, published_at=now() WHERE id=?", version, course);

        assertThatThrownBy(() -> jdbc.update("UPDATE course_publication_versions SET title='x' WHERE id=?", version))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("UPDATE course_publication_version_lessons SET title='x' WHERE id=?", vLesson))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM course_publication_version_chapters WHERE id=?", vChapter))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM course_publication_version_tags WHERE version_id=?", version))
                .hasMessageContaining("append-only");
        // A snapshotted lesson/chapter/course can never be hard-deleted.
        assertThatThrownBy(() -> jdbc.update("DELETE FROM lessons WHERE id=?", lessonId))
                .hasMessageContaining("violates foreign key");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM courses WHERE id=?", course))
                .hasMessageContaining("violates foreign key");

        UUID history = jdbc.queryForObject(
                "INSERT INTO course_moderation_history(course_id, actor_id, action, from_workflow_status,"
                        + " to_workflow_status, from_publication_status, to_publication_status, version_id)"
                        + " VALUES (?,?,'APPROVE','PENDING','PUBLISHED','UNPUBLISHED','PUBLISHED',?) RETURNING id",
                UUID.class, course, author, version);
        assertThatThrownBy(() -> jdbc.update("UPDATE course_moderation_history SET note='x' WHERE id=?", history))
                .hasMessageContaining("append-only");

        UUID foreign = course();
        assertThatThrownBy(() -> jdbc.update("UPDATE courses SET published_version_id=? WHERE id=?", version, foreign))
                .hasMessageContaining("ck_courses_");
    }

    @Test
    void enrollmentRemembersLastLessonAndLessonsStillGateProgress() {
        UUID lessonId = lesson(course, chapter, 1, "t", null, null);
        UUID learner = insertUser(jdbc);
        UUID enrollment = jdbc.queryForObject(
                "INSERT INTO course_enrollments(user_id, course_id, source) VALUES (?,?,'FREE') RETURNING id",
                UUID.class, learner, course);
        assertThatThrownBy(() -> jdbc.update(
                        "UPDATE course_enrollments SET last_lesson_id=? WHERE id=?", lessonId, enrollment))
                .hasMessageContaining("ck_course_enrollments_last_access");
        jdbc.update("UPDATE course_enrollments SET last_lesson_id=?, last_accessed_at=now() WHERE id=?",
                lessonId, enrollment);
        assertThatThrownBy(() -> jdbc.update(
                        "UPDATE course_enrollments SET last_lesson_id=gen_random_uuid() WHERE id=?", enrollment))
                .hasMessageContaining("violates foreign key");
        jdbc.update("INSERT INTO lesson_progress(user_id, lesson_id) VALUES (?,?)", learner, lessonId);
    }

    @Test
    void leavesPaymentAndRefundObjectsUntouched() {
        assertThat(count("information_schema.tables", "table_name IN ('refunds','orders','payment_transactions')"))
                .isEqualTo(3);
        assertThat(count("pg_trigger", "tgname='trg_refunds_revoke_course_access'")).isEqualTo(1);
        assertThat(count("pg_proc", "proname='grant_course_access_after_payment'")).isEqualTo(1);
    }

    @Test
    void abortsWhenCoursesOrLessonsAlreadyExist() {
        String db = "legacy_courses";
        jdbc.execute("CREATE DATABASE " + db);
        String url = postgres.getJdbcUrl().replaceFirst("/[^/?]+(\\?|$)", "/" + db + "$1");
        flyway(url, "11").migrate();
        var legacy = new JdbcTemplate(dataSource(url));
        UUID user = insertUser(legacy);
        UUID t = legacy.queryForObject("INSERT INTO topics(name) VALUES ('Old') RETURNING id", UUID.class);
        legacy.update("INSERT INTO courses(author_id, topic_id, title, summary, description, level)"
                + " VALUES (?,?,'Old','S','D','BEGINNER')", user, t);
        assertThatThrownBy(() -> flyway(url, null).migrate())
                .hasStackTraceContaining("V12 requires empty courses and lessons tables");
    }

    // ------------------------------------------------------------------ helpers

    private UUID course() {
        return jdbc.queryForObject(
                "INSERT INTO courses(author_id, topic_id, title, summary, description, level, content_fingerprint)"
                        + " VALUES (?,?,'T','S','D','BEGINNER',?) RETURNING id",
                UUID.class, author, topic, HEX);
    }

    private UUID chapter(UUID courseId, int position) {
        return jdbc.queryForObject(
                "INSERT INTO course_chapters(course_id, title, position) VALUES (?,'Intro',?) RETURNING id",
                UUID.class, courseId, position);
    }

    private UUID lesson(UUID courseId, UUID chapterId, int position, String content, String provider, String video) {
        return jdbc.queryForObject(
                "INSERT INTO lessons(course_id, chapter_id, title, content, video_provider, video_id, position,"
                        + " content_fingerprint) VALUES (?,?,'L',?,?,?,?,?) RETURNING id",
                UUID.class, courseId, chapterId, content, provider, video, position, HEX);
    }

    private int count(String from, String where) {
        return jdbc.queryForObject("SELECT count(*) FROM " + from + " WHERE " + where
                + (from.startsWith("information_schema") ? " AND table_schema='techverse'" : ""), Integer.class);
    }

    private static UUID insertUser(JdbcTemplate t) {
        return t.queryForObject("INSERT INTO users(full_name, email) VALUES ('Author', ?) RETURNING id",
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
