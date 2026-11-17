package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

import java.util.*;

class CourseStudentsIntegrationTest extends CourseIntegrationTestBase {
    String students(String course) {
        return AUTHOR + "/" + course + "/students";
    }

    /** Enrolls a fresh learner named {@code name}; granted {@code daysAgo} days ago. */
    UUID enroll(String course, String name, int daysAgo, String... doneLessons) {
        UUID id = user(name.toLowerCase() + "@example.com", null);
        jdbc.update("UPDATE techverse.users SET full_name=? WHERE id=?", name, id);
        enrollExisting(course, id, daysAgo, doneLessons);
        return id;
    }

    void enrollExisting(String course, UUID id, int daysAgo, String... doneLessons) {
        jdbc.update("INSERT INTO techverse.course_enrollments(user_id,course_id,source,granted_at)"
                + " VALUES (?,?::uuid,'FREE', now() - make_interval(days => ?))", id, course, daysAgo);
        for (String lesson : doneLessons)
            jdbc.update("INSERT INTO techverse.lesson_progress(user_id,lesson_id) VALUES (?,?::uuid)", id, lesson);
    }

    List<String> lessonIds(String course) throws Exception {
        var ids = new ArrayList<String>();
        for (var chapter : data(get(AUTHOR + "/" + course, authorToken)).path("chapters"))
            for (var lesson : chapter.path("lessons")) ids.add(lesson.path("id").asText());
        return ids;
    }

    @Test
    void listsActiveStudentsNewestFirstWithProgressAndAnUnfilteredSummary() throws Exception {
        String id = publishedCourse("Free");
        var l = lessonIds(id);
        enroll(id, "Cam Done", 3, l.get(0), l.get(1), l.get(2));
        enroll(id, "Binh Half", 2, l.get(0));
        UUID anh = enroll(id, "Anh Fresh", 1);
        UUID gone = enroll(id, "Dung Gone", 5, l.get(0));
        jdbc.update("UPDATE techverse.course_enrollments SET revoked_at=now() WHERE user_id=?", gone);
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", anh);

        var response = get(students(id), authorToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.students.content[*].fullName", contains("Anh Fresh", "Binh Half", "Cam Done")))
                .andExpect(jsonPath("$.data.students.content[*].completedLessons", contains(0, 1, 3)))
                .andExpect(jsonPath("$.data.students.content[*].totalLessons", contains(3, 3, 3)))
                .andExpect(jsonPath("$.data.students.content[0].lastAccessedAt").value(nullValue()))
                .andExpect(jsonPath("$.data.students.totalElements").value(3))
                .andExpect(jsonPath("$.data.summary.total").value(3))
                .andExpect(jsonPath("$.data.summary.notStarted").value(1))
                .andExpect(jsonPath("$.data.summary.completed").value(1))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain("@example.com").doesNotContain("email");

        get(students(id) + "?progress=NOT_STARTED", authorToken)
                .andExpect(jsonPath("$.data.students.content[*].fullName", contains("Anh Fresh")))
                .andExpect(jsonPath("$.data.summary.total").value(3));
        get(students(id) + "?progress=IN_PROGRESS", authorToken)
                .andExpect(jsonPath("$.data.students.content[*].fullName", contains("Binh Half")));
        get(students(id) + "?progress=COMPLETED", authorToken)
                .andExpect(jsonPath("$.data.students.content[*].fullName", contains("Cam Done")))
                .andExpect(jsonPath("$.data.summary.notStarted").value(1));
        get(students(id) + "?q= bINH ", authorToken)
                .andExpect(jsonPath("$.data.students.content[*].fullName", contains("Binh Half")))
                .andExpect(jsonPath("$.data.summary.total").value(3));
        get(students(id) + "?q=   ", authorToken).andExpect(jsonPath("$.data.students.totalElements").value(3));
        get(students(id) + "?size=2&page=1", authorToken)
                .andExpect(jsonPath("$.data.students.content[*].fullName", contains("Cam Done")))
                .andExpect(jsonPath("$.data.students.totalElements").value(3));
    }

    @Test
    void paidCourseStudentsAreListedTooAndAnUnpublishedCourseIsEmpty() throws Exception {
        String paid = publishedPaidCourse("Paid", 199_000);
        UUID buyer = user("buyer@example.com", null);
        UUID admin = jdbc.queryForObject("SELECT id FROM techverse.users WHERE email='admin@example.com'", UUID.class);
        jdbc.update("INSERT INTO techverse.course_enrollments(user_id,course_id,source,granted_by) VALUES (?,?::uuid,'ADMIN_GRANT',?)",
                buyer, paid, admin);
        get(students(paid), authorToken).andExpect(jsonPath("$.data.students.totalElements").value(1))
                .andExpect(jsonPath("$.data.students.content[0].totalLessons").value(3));
        String draft = course("Draft", new LinkedHashMap<>(Map.of("A", List.of("A1"))));
        get(students(draft), authorToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.students.content", hasSize(0)))
                .andExpect(jsonPath("$.data.summary.total").value(0));
    }

    @Test
    void rejectsBadFiltersAndTreatsPercentAndUnderscoreLiterally() throws Exception {
        String id = publishedCourse("Filters");
        enroll(id, "Binh Half", 1);
        enroll(id, "ĐẶNG Văn", 4);
        get(students(id) + "?q=đặng", authorToken)
                .andExpect(jsonPath("$.data.students.content[*].fullName", contains("ĐẶNG Văn")));
        get(students(id) + "?progress=FOO", authorToken).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COURSE_STUDENT_FILTER_INVALID"));
        get(students(id) + "?q=" + "x".repeat(101), authorToken).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COURSE_STUDENT_FILTER_INVALID"));
        get(students(id) + "?q=" + "x".repeat(100), authorToken).andExpect(status().isOk());
        for (String q : List.of("%", "_", "B_nh"))
            get(students(id) + "?q=" + q, authorToken).andExpect(jsonPath("$.data.students.totalElements").value(0));
    }

    @Test
    void onlyTheOwningAuthorCanRead() throws Exception {
        String id = publishedCourse("Owned");
        user("other@example.com", "AUTHOR");
        get(students(id), login("other@example.com")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        get(students(UUID.randomUUID().toString()), authorToken).andExpect(status().isNotFound());
        for (String token : List.of(adminToken, modToken, learnerToken))
            get(students(id), token).andExpect(status().isForbidden());
        get(students(id), null).andExpect(status().isUnauthorized());
    }

    @Test
    void progressFollowsThePublishedVersionLikeMyCourses() throws Exception {
        String id = publishedCourse("Versions");
        var l = lessonIds(id);
        enrollExisting(id, learner, 1, l.get(0), l.get(1), l.get(2));
        // Version 2 drops A2 (done) and adds A3 (not done).
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(AUTHOR + "/" + id + "/lessons/" + l.get(1))
                        .header("Authorization", "Bearer " + authorToken)).andExpect(status().isOk());
        var chapter = data(get(AUTHOR + "/" + id, authorToken)).path("chapters").get(0).path("id").asText();
        addLesson(id, chapter, "A3", false);
        publish(id);
        get(students(id), authorToken)
                .andExpect(jsonPath("$.data.students.content[0].completedLessons").value(2))
                .andExpect(jsonPath("$.data.students.content[0].totalLessons").value(3));
        get("/api/v1/me/courses", learnerToken)
                .andExpect(jsonPath("$.data.content[0].progress.completed").value(2))
                .andExpect(jsonPath("$.data.content[0].progress.total").value(3));
    }

    @Test
    void studentCountIsOnTheAuthorListAndDetail() throws Exception {
        String a = publishedCourse("Counted"), b = publishedCourse("Empty");
        enroll(a, "Binh Half", 1);
        UUID gone = enroll(a, "Dung Gone", 2);
        jdbc.update("UPDATE techverse.course_enrollments SET revoked_at=now() WHERE user_id=?", gone);
        get(AUTHOR + "/" + a, authorToken).andExpect(jsonPath("$.data.studentCount").value(1));
        get(AUTHOR + "/" + b, authorToken).andExpect(jsonPath("$.data.studentCount").value(0));
        get(AUTHOR, authorToken)
                .andExpect(jsonPath("$.data.content[?(@.id=='" + a + "')].studentCount", contains(1)))
                .andExpect(jsonPath("$.data.content[?(@.id=='" + b + "')].studentCount", contains(0)));
    }
}
