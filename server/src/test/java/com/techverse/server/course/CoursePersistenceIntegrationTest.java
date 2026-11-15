package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;

import com.techverse.server.article.ArticleIntegrationTestBase;
import com.techverse.server.entity.*;
import com.techverse.server.enums.CourseLevel;
import com.techverse.server.repository.*;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

/** Real JPA insert order/flush across several approved versions (cascades + archive). */
class CoursePersistenceIntegrationTest extends ArticleIntegrationTestBase {
    @Autowired TransactionTemplate tx;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired CourseRepository courses;
    @Autowired CourseModerationHistoryRepository histories;
    @Autowired UserRepository users;
    @Autowired TopicRepository topics;
    @Autowired TagRepository tags;

    @BeforeEach
    void clean() {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
    }

    @Test
    void approveArchiveAndDeleteAcrossVersionsPersist() {
        UUID[] ids = new UUID[4]; // course, chapter, lesson kept, lesson removed
        tx.executeWithoutResult(
                s -> {
                    User author = users.save(User.createLocalAccount("A", "a@example.com", "x"));
                    User mod = users.save(User.createLocalAccount("M", "m@example.com", "x"));
                    Topic topic = topics.save(Topic.builder().name("Backend").build());
                    Tag tag = tags.save(Tag.builder().name("Java").build());
                    Course c =
                            Course.builder()
                                    .author(author)
                                    .topic(topic)
                                    .title("Spring")
                                    .summary("S")
                                    .description("D")
                                    .level(CourseLevel.BEGINNER)
                                    .build();
                    c.replaceTags(java.util.List.of(tag));
                    var ch = c.addChapter("Intro", 1);
                    var l1 = c.addLesson(ch, "L1", null, "text", null, false, 1);
                    var l2 = c.addLesson(ch, "L2", null, "text 2", null, true, 2);
                    courses.saveAndFlush(c); // IDs are part of the fingerprint
                    c.save();
                    c.submit();
                    var h1 = c.approve(mod, null, Instant.now());
                    em.flush();
                    histories.save(h1);
                    em.flush();
                    ids[0] = c.getId();
                    ids[1] = ch.getId();
                    ids[2] = l1.getId();
                    ids[3] = l2.getId();
                });
        tx.executeWithoutResult(
                s -> {
                    Course c = courses.findByIdForUpdate(ids[0]).orElseThrow();
                    User mod = users.findByEmail("m@example.com").orElseThrow();
                    var l2 = c.activeLessons().get(1);
                    c.removeLesson(l2);
                    var ch2 = c.addChapter("Next", 2);
                    c.addLesson(ch2, "L3", null, null, "https://youtu.be/dQw4w9WgXcQ", false, 1);
                    em.flush();
                    c.save();
                    c.submit();
                    var h2 = c.approve(mod, "ok", Instant.now());
                    em.flush();
                    histories.save(h2);
                    em.flush();
                });
        tx.executeWithoutResult(
                s -> {
                    Course c = courses.findByIdForUpdate(ids[0]).orElseThrow();
                    c.removeChapter(c.activeChapters().get(0));
                    c.save();
                    em.flush();
                });
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM techverse.course_publication_versions WHERE course_id=?",
                        Integer.class, ids[0]))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject(
                        "SELECT archived_at IS NOT NULL FROM techverse.lessons WHERE id=?",
                        Boolean.class, ids[3]))
                .isTrue();
        assertThat(jdbc.queryForObject(
                        "SELECT archived_at IS NOT NULL FROM techverse.course_chapters WHERE id=?",
                        Boolean.class, ids[1]))
                .isTrue();
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM techverse.course_publication_version_lessons vl"
                                + " JOIN techverse.course_publication_versions v ON v.id=vl.version_id"
                                + " WHERE v.version_number=2",
                        Integer.class))
                .isEqualTo(2);
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM techverse.course_moderation_history WHERE course_id=? AND version_id IS NOT NULL",
                        Integer.class, ids[0]))
                .isEqualTo(2);
    }
}
