package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.JsonNode;

import java.util.*;

class ModeratorCourseIntegrationTest extends CourseIntegrationTestBase {

    @Test
    void reviewQueueSelfReviewNotesStaleTokenAndApprove() throws Exception {
        var tree = new LinkedHashMap<String, List<String>>();
        tree.put("A", List.of("A1"));
        String draft = course("Private draft", tree);
        String id = course("Pending", tree);
        submit(id);

        get(MOD, modToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].course.id").value(id))
                .andExpect(jsonPath("$.data.content[0].authorEligible").value(true));
        get(MOD + "/" + draft, modToken).andExpect(status().isNotFound());
        get(MOD, learnerToken).andExpect(status().isForbidden());
        get(MOD, adminToken).andExpect(status().isForbidden());
        var detail = data(get(MOD + "/" + id, modToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.course.chapters[0].lessons[0].title").value("A1"))
                .andExpect(jsonPath("$.data.course.chapters[0].lessons[0].content").doesNotExist())
                .andExpect(jsonPath("$.data.course.priceAmount").doesNotExist())
                .andExpect(jsonPath("$.data.changes[0].changeStatus").value("NEW"))
                .andExpect(jsonPath("$.data.changes[0].lessons[0].changeStatus").value("NEW")));
        String lesson = detail.at("/course/chapters/0/lessons/0/id").asText();
        get(MOD + "/" + id + "/lessons/" + lesson, modToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("Body of A1"));

        review(id, "REQUEST_CHANGES", "  ").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COURSE_REVIEW_NOTE_REQUIRED"));
        send(patch(MOD + "/" + id + "/review"), modToken,
                        Map.of("decision", "APPROVE", "reviewToken", "a".repeat(64)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURSE_REVIEW_STALE"));
        send(patch(MOD + "/" + id + "/review"), modToken,
                        Map.of("decision", "REQUEST_CHANGES", "reviewToken", reviewToken(id), "moderationNote", "x".repeat(2001)))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // An Author who is also a Moderator cannot review their own course.
        jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name='MODERATOR'", author);
        String selfToken = login("author@example.com");
        send(patch(MOD + "/" + id + "/review"), selfToken, Map.of("decision", "APPROVE", "reviewToken", reviewToken(id)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COURSE_SELF_REVIEW_NOT_ALLOWED"));

        review(id, "APPROVE", " Looks good ").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.course.workflowStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.course.publicationStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.course.publishedVersion.versionNumber").value(1))
                .andExpect(jsonPath("$.data.history[0].action").value("APPROVE"))
                .andExpect(jsonPath("$.data.history[0].note").value("Looks good"))
                .andExpect(jsonPath("$.data.history[0].versionNumber").value(1));
        get(MOD + "/" + id + "/history", modToken).andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void changeStatusFollowsFingerprintMetadataAndOrderAndSnapshotsStayImmutable() throws Exception {
        String id = publishedCourse("Diff");
        var v1 = data(get(MOD + "/" + id, modToken)).path("course");
        String v1Id = v1.at("/publishedVersion/id").asText();
        String chapterA = v1.at("/chapters/0/id").asText();
        String chapterB = v1.at("/chapters/1/id").asText();
        String a2 = v1.at("/chapters/0/lessons/1/id").asText();

        send(patch(AUTHOR + "/" + id + "/lessons/" + a2), authorToken, Map.of("content", "New body"))
                .andExpect(status().isOk());
        addLesson(id, chapterA, "A3", false);
        mvc.perform(delete(AUTHOR + "/" + id + "/chapters/" + chapterB).header("Authorization", "Bearer " + authorToken))
                .andExpect(status().isOk());
        String chapterC = addChapter(id, "C");
        addLesson(id, chapterC, "C1", false);
        submit(id);

        var changes = data(get(MOD + "/" + id, modToken)).path("changes");
        assertThat(statusOf(changes, "A")).isEqualTo("CHANGED"); // lesson list changed
        assertThat(statusOf(changes, "B")).isEqualTo("ARCHIVED");
        assertThat(statusOf(changes, "C")).isEqualTo("NEW");
        assertThat(statusOf(changes, "A1")).isEqualTo("UNCHANGED");
        assertThat(statusOf(changes, "A2")).isEqualTo("CHANGED");
        assertThat(statusOf(changes, "A3")).isEqualTo("NEW");
        assertThat(statusOf(changes, "B1")).isEqualTo("ARCHIVED");
        assertThat(statusOf(changes, "C1")).isEqualTo("NEW");

        get(MOD + "/" + id + "/lessons/" + a2, modToken).andExpect(jsonPath("$.data.content").value("New body"));
        get(MOD + "/" + id + "/lessons/" + a2 + "?versionId=" + v1Id, modToken)
                .andExpect(jsonPath("$.data.content").value("Body of A2"))
                .andExpect(jsonPath("$.data.versionId").value(v1Id));

        review(id, "APPROVE", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.course.publishedVersion.versionNumber").value(2));
        // Version 1 is untouched by the edits and by approving version 2.
        get(MOD + "/" + id + "/lessons/" + a2 + "?versionId=" + v1Id, modToken)
                .andExpect(jsonPath("$.data.content").value("Body of A2"));
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM techverse.course_publication_version_lessons WHERE version_id=?::uuid",
                        Integer.class, v1Id))
                .isEqualTo(3);

        // Reordering alone marks the chapter and the moved lessons CHANGED.
        var lessons = data(get(MOD + "/" + id, modToken)).at("/course/chapters/0/lessons");
        var ids = new ArrayList<String>();
        lessons.forEach(l -> ids.add(l.path("id").asText()));
        Collections.reverse(ids);
        send(put(AUTHOR + "/" + id + "/chapters/" + chapterA + "/lessons:reorder"), authorToken, Map.of("ids", ids))
                .andExpect(status().isOk());
        submit(id);
        changes = data(get(MOD + "/" + id, modToken)).path("changes");
        assertThat(statusOf(changes, "A")).isEqualTo("CHANGED");
        assertThat(statusOf(changes, "A1")).isEqualTo("CHANGED");
        assertThat(statusOf(changes, "C")).isEqualTo("UNCHANGED");
    }

    @Test
    void publicationHideRestoreRemoveWithNotesAndPublicVisibility() throws Exception {
        String id = publishedCourse("Visible");
        get(PUBLIC + "/" + id, null).andExpect(status().isOk());

        publication(id, "HIDE", null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COURSE_PUBLICATION_NOTE_REQUIRED"));
        publication(id, "HIDE", "Spam").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.course.publicationStatus").value("HIDDEN"));
        get(PUBLIC + "/" + id, null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        send(patch(AUTHOR + "/" + id + "/publication"), authorToken, Map.of("action", "UNHIDE"))
                .andExpect(jsonPath("$.code").value("COURSE_AUTHOR_UNHIDE_NOT_ALLOWED"));

        publication(id, "RESTORE", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.course.publicationStatus").value("PUBLISHED"));
        get(PUBLIC + "/" + id, null).andExpect(status().isOk());

        publication(id, "REMOVE", "Policy").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.course.publicationStatus").value("REMOVED"));
        publication(id, "RESTORE", null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURSE_PUBLICATION_TRANSITION_INVALID"));
        get(PUBLIC + "/" + id, null).andExpect(status().isNotFound());
        get(MOD + "/" + id + "/history", modToken)
                .andExpect(jsonPath("$.data.content[0].action").value("REMOVE"))
                .andExpect(jsonPath("$.data.content[0].note").value("Policy"))
                .andExpect(jsonPath("$.data.totalElements").value(4));
    }

    @Test
    void approveRechecksAuthorAndTaxonomy() throws Exception {
        var tree = new LinkedHashMap<String, List<String>>();
        tree.put("A", List.of("A1"));
        String id = course("Recheck", tree);
        submit(id);

        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        review(id, "APPROVE", null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_READY"));
        jdbc.update("UPDATE techverse.topics SET is_active=true WHERE id=?", topic);

        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        review(id, "APPROVE", null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURSE_AUTHOR_INELIGIBLE"));
        // REQUEST_CHANGES still works for an ineligible author.
        review(id, "REQUEST_CHANGES", "Fix it").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.course.workflowStatus").value("CHANGES_REQUESTED"));
    }

    /** changeStatus of the chapter or lesson with this title in the diff tree. */
    static String statusOf(JsonNode chapters, String title) {
        for (JsonNode chapter : chapters) {
            if (chapter.path("title").asText().equals(title)) return chapter.path("changeStatus").asText();
            for (JsonNode lesson : chapter.path("lessons"))
                if (lesson.path("title").asText().equals(title)) return lesson.path("changeStatus").asText();
        }
        throw new AssertionError("No node titled " + title + " in " + chapters);
    }
}
