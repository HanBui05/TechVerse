package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;

import java.util.*;

class CourseLearningIntegrationTest extends CourseIntegrationTestBase {
    @org.springframework.beans.factory.annotation.Autowired javax.sql.DataSource dataSource;

    @Test
    void startIsIdempotentAndBlockedForGuestsOwnersManagersAndHiddenCourses() throws Exception {
        String id = publishedCourse("Start");
        String a1 = lessonId(id, 0, 0);
        start(id, learnerToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.continueLesson.id").value(a1))
                .andExpect(jsonPath("$.data.progress.completed").value(0))
                .andExpect(jsonPath("$.data.progress.total").value(3))
                .andExpect(jsonPath("$.data.progress.percent").value(0));
        start(id, learnerToken).andExpect(status().isOk()).andExpect(jsonPath("$.data.continueLesson.id").value(a1));
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM techverse.course_enrollments WHERE user_id=? AND source='FREE'", Integer.class, learner))
                .isEqualTo(1);

        start(id, null).andExpect(status().isUnauthorized());
        start(id, authorToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        start(id, modToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        start(id, adminToken).andExpect(status().isForbidden());
        start(UUID.randomUUID().toString(), learnerToken).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        publication(id, "HIDE", "Spam").andExpect(status().isOk());
        start(id, learnerToken).andExpect(status().isNotFound());
    }

    @Test
    void openingLessonsUpdatesContinueLearningOnlyForEnrolledLearners() throws Exception {
        String id = publishedCourse("Open");
        String a1 = lessonId(id, 0, 0), a2 = lessonId(id, 0, 1);
        get(PUBLIC + "/" + id + "/lessons/" + a1, learnerToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.learning").value(nullValue()));
        assertThat(jdbc.queryForList("SELECT 1 FROM techverse.course_enrollments")).isEmpty();

        start(id, learnerToken);
        get(PUBLIC + "/" + id + "/lessons/" + a1, learnerToken).andExpect(status().isOk());
        get(PUBLIC + "/" + id + "/lessons/" + a2, learnerToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lesson.content").value("Body of A2"))
                .andExpect(jsonPath("$.data.learning.continueLesson.id").value(a2))
                .andExpect(jsonPath("$.data.learning.completedLessonIds").isEmpty());
        var row = jdbc.queryForMap("SELECT last_lesson_id, last_accessed_at FROM techverse.course_enrollments WHERE user_id=?", learner);
        assertThat(row.get("last_lesson_id")).hasToString(a2);
        assertThat(row.get("last_accessed_at")).isNotNull();
        get(PUBLIC + "/" + id, learnerToken)
                .andExpect(jsonPath("$.data.viewer.enrolled").value(true))
                .andExpect(jsonPath("$.data.learning.continueLesson.id").value(a2))
                .andExpect(jsonPath("$.data.learning.chapters[0].total").value(2));

        // A manager keeps preview-only access even with an enrollment row.
        jdbc.update("INSERT INTO techverse.course_enrollments(user_id,course_id,source) VALUES (?,?::uuid,'FREE')", moderator, id);
        get(PUBLIC + "/" + id + "/lessons/" + a2, modToken).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(PUBLIC + "/" + id, modToken).andExpect(jsonPath("$.data.viewer.enrolled").value(false))
                .andExpect(jsonPath("$.data.learning").value(nullValue()));
        assertThat(jdbc.queryForObject(
                        "SELECT last_lesson_id FROM techverse.course_enrollments WHERE user_id=?", UUID.class, moderator))
                .isNull();
    }

    @Test
    void completionIsIdempotentAndProgressFollowsTheCurrentSnapshot() throws Exception {
        String id = publishedCourse("Progress");
        String a1 = lessonId(id, 0, 0), a2 = lessonId(id, 0, 1), b1 = lessonId(id, 1, 0);
        completion(put(PUBLIC + "/" + id + "/lessons/" + a1 + "/completion"), learnerToken)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURSE_ENROLLMENT_REQUIRED"));
        start(id, learnerToken);
        for (int i = 0; i < 2; i++)
            completion(put(PUBLIC + "/" + id + "/lessons/" + a1 + "/completion"), learnerToken)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.progress.completed").value(1))
                    .andExpect(jsonPath("$.data.progress.percent").value(33))
                    .andExpect(jsonPath("$.data.chapters[0].completed").value(1))
                    .andExpect(jsonPath("$.data.chapters[0].percent").value(50))
                    .andExpect(jsonPath("$.data.completedLessonIds", contains(a1)));
        for (int i = 0; i < 2; i++)
            completion(delete(PUBLIC + "/" + id + "/lessons/" + a1 + "/completion"), learnerToken)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.progress.completed").value(0));
        completion(put(PUBLIC + "/" + id + "/lessons/" + UUID.randomUUID() + "/completion"), learnerToken)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LESSON_NOT_FOUND"));
        completion(put(PUBLIC + "/" + id + "/lessons/" + a1 + "/completion"), modToken)
                .andExpect(status().isForbidden());
        completion(put(PUBLIC + "/" + id + "/lessons/" + a1 + "/completion"), authorToken)
                .andExpect(status().isForbidden());

        for (String lesson : List.of(a1, a2, b1))
            completion(put(PUBLIC + "/" + id + "/lessons/" + lesson + "/completion"), learnerToken);
        // Archive A2 in version 2: the denominator and completed IDs follow the new snapshot.
        mvc.perform(delete(AUTHOR + "/" + id + "/lessons/" + a2).header("Authorization", "Bearer " + authorToken))
                .andExpect(status().isOk());
        publish(id);
        get(PUBLIC + "/" + id, learnerToken)
                .andExpect(jsonPath("$.data.learning.progress.total").value(2))
                .andExpect(jsonPath("$.data.learning.progress.percent").value(100))
                .andExpect(jsonPath("$.data.learning.completedLessonIds", containsInAnyOrder(a1, b1)));
        completion(put(PUBLIC + "/" + id + "/lessons/" + a2 + "/completion"), learnerToken)
                .andExpect(status().isNotFound());
        addLesson(id, chapterId(id, 0), "A3", false);
        publish(id);
        get(PUBLIC + "/" + id, learnerToken)
                .andExpect(jsonPath("$.data.learning.progress.completed").value(2))
                .andExpect(jsonPath("$.data.learning.progress.total").value(3))
                .andExpect(jsonPath("$.data.learning.progress.percent").value(66));
    }

    @Test
    void myCoursesSortByAccessThenGrantAndFallBackToTheFirstLesson() throws Exception {
        String x = publishedCourse("X");
        String y = publishedCourse("Y");
        String z = publishedCourse("Z");
        String xa2 = lessonId(x, 0, 1);
        start(x, learnerToken);
        start(y, learnerToken);
        start(z, learnerToken);
        get(PUBLIC + "/" + x + "/lessons/" + xa2, learnerToken).andExpect(status().isOk());
        completion(put(PUBLIC + "/" + x + "/lessons/" + xa2 + "/completion"), learnerToken);

        get("/api/v1/me/courses", learnerToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[*].course.id", contains(x, z, y)))
                .andExpect(jsonPath("$.data.content[0].continueLesson.id").value(xa2))
                .andExpect(jsonPath("$.data.content[0].progress.completed").value(1))
                .andExpect(jsonPath("$.data.content[0].progress.total").value(3))
                .andExpect(jsonPath("$.data.content[1].continueLesson.id").value(lessonId(z, 0, 0)))
                .andExpect(jsonPath("$.data.content[0].priceAmount").doesNotExist());
        get("/api/v1/me/courses?size=1&page=1", learnerToken).andExpect(jsonPath("$.data.content[*].course.id", contains(z)));
        get("/api/v1/me/courses", null).andExpect(status().isUnauthorized());

        // Last lesson archived in a new version: continue falls back to the first lesson.
        mvc.perform(delete(AUTHOR + "/" + x + "/lessons/" + xa2).header("Authorization", "Bearer " + authorToken))
                .andExpect(status().isOk());
        publish(x);
        get("/api/v1/me/courses", learnerToken)
                .andExpect(jsonPath("$.data.content[0].continueLesson.id").value(lessonId(x, 0, 0)))
                .andExpect(jsonPath("$.data.content[0].progress.completed").value(0))
                .andExpect(jsonPath("$.data.content[0].progress.total").value(2));
        get(PUBLIC + "/" + x, learnerToken).andExpect(jsonPath("$.data.learning.continueLesson.id").value(lessonId(x, 0, 0)));

        // Hidden courses leave the list but keep their enrollment.
        publication(y, "HIDE", "Spam").andExpect(status().isOk());
        get("/api/v1/me/courses", learnerToken).andExpect(jsonPath("$.data.content[*].course.id", contains(x, z)));
        publication(y, "RESTORE", null).andExpect(status().isOk());
        get("/api/v1/me/courses", learnerToken).andExpect(jsonPath("$.data.content[*].course.id", contains(x, z, y)));

        // A learner later promoted to manager reads like a non-enrolled account: no courses, no progress.
        jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name='MODERATOR'", learner);
        get("/api/v1/me/courses", learnerToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0))
                .andExpect(jsonPath("$.data.content").isEmpty());
    }

    @Test
    void completionWaitsForAConcurrentPublicationChange() throws Exception {
        String id = publishedCourse("Locked");
        String a1 = lessonId(id, 0, 0);
        start(id, learnerToken);
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var lock = connection.prepareStatement("SELECT 1 FROM techverse.courses WHERE id=?::uuid FOR UPDATE")) {
                lock.setString(1, id);
                lock.executeQuery();
            }
            var pending = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                try {
                    return completion(put(PUBLIC + "/" + id + "/lessons/" + a1 + "/completion"), learnerToken)
                            .andReturn().getResponse().getStatus();
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            Thread.sleep(1000);
            assertThat(pending).isNotDone();
            connection.rollback();
            assertThat(pending.get(10, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
        }
    }

    // ------------------------------------------------------------------ helpers

    ResultActions start(String course, String token) throws Exception {
        return send(post(PUBLIC + "/" + course + "/start"), token, Map.of());
    }

    ResultActions completion(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String token)
            throws Exception {
        return send(request, token, Map.of());
    }

    JsonNode publicDetail(String course) throws Exception {
        return data(get(PUBLIC + "/" + course, null));
    }

    String lessonId(String course, int chapter, int lesson) throws Exception {
        return publicDetail(course).at("/chapters/" + chapter + "/lessons/" + lesson + "/id").asText();
    }

    String chapterId(String course, int chapter) throws Exception {
        return publicDetail(course).at("/chapters/" + chapter + "/id").asText();
    }
}
