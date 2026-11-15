package com.techverse.server.course;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

import java.util.*;

class PublishedCourseIntegrationTest extends CourseIntegrationTestBase {

    @Test
    void listShowsVisibleSnapshotsWithFiltersAndPagination() throws Exception {
        String older = publishedCourse("Spring basics");
        String newer = publishedCourse("Java 100%_safe");
        var tree = new LinkedHashMap<String, List<String>>();
        tree.put("A", List.of("A1"));
        course("Draft only", tree);
        // Working-copy edits after publishing never reach readers.
        send(patch(AUTHOR + "/" + older), authorToken, Map.of("action", "SAVE", "title", "Renamed draft"))
                .andExpect(status().isOk());

        get(PUBLIC, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content[0].id").value(newer))
                .andExpect(jsonPath("$.data.content[1].title").value("Spring basics"))
                .andExpect(jsonPath("$.data.content[1].author.fullName").value("User author@example.com"))
                .andExpect(jsonPath("$.data.content[1].tags[0].name").value("Java"))
                .andExpect(jsonPath("$.data.content[1].level").value("INTERMEDIATE"))
                .andExpect(jsonPath("$.data.content[1].priceAmount").doesNotExist())
                .andExpect(jsonPath("$.data.content[1].chapters").doesNotExist());
        get(PUBLIC + "?sort=OLDEST&size=1", null)
                .andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(older))
                .andExpect(jsonPath("$.data.totalPages").value(2));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(PUBLIC).param("keyword", "100%_s"))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(newer));
        get(PUBLIC + "?keyword=renamed", null).andExpect(jsonPath("$.data.totalElements").value(0));
        get(PUBLIC + "?level=INTERMEDIATE&topicId=" + topic + "&tagId=" + tag, learnerToken)
                .andExpect(jsonPath("$.data.totalElements").value(2));
        get(PUBLIC + "?level=ADVANCED", null).andExpect(jsonPath("$.data.totalElements").value(0));
        get(PUBLIC + "?tagId=" + UUID.randomUUID(), null).andExpect(jsonPath("$.data.totalElements").value(0));
        get(PUBLIC + "?size=101", null).andExpect(status().isBadRequest());
    }

    @Test
    void detailReturnsSnapshotCurriculumInfoCardAndPreviewOnlyLessonsForGuests() throws Exception {
        String id = publishedCourse("Detail");
        send(patch(AUTHOR + "/" + id), authorToken, Map.of("action", "SAVE", "title", "Working title"))
                .andExpect(status().isOk());
        var detail = data(get(PUBLIC + "/" + id, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Detail"))
                .andExpect(jsonPath("$.data.description").value("Description"))
                .andExpect(jsonPath("$.data.chapterCount").value(2))
                .andExpect(jsonPath("$.data.lessonCount").value(3))
                .andExpect(jsonPath("$.data.updatedAt").isString())
                .andExpect(jsonPath("$.data.publishedAt").isString())
                .andExpect(jsonPath("$.data.author.expertise").value("Java"))
                .andExpect(jsonPath("$.data.viewer.enrolled").value(false))
                .andExpect(jsonPath("$.data.viewer.canStart").value(true))
                .andExpect(jsonPath("$.data.learning").value(nullValue()))
                .andExpect(jsonPath("$.data.chapters[0].title").value("A"))
                .andExpect(jsonPath("$.data.chapters[0].lessons[0].preview").value(true))
                .andExpect(jsonPath("$.data.chapters[0].lessons[0].hasContent").value(true))
                .andExpect(jsonPath("$.data.chapters[0].lessons[0].content").doesNotExist())
                .andExpect(jsonPath("$.data.priceAmount").doesNotExist()));
        String a1 = detail.at("/chapters/0/lessons/0/id").asText();
        String a2 = detail.at("/chapters/0/lessons/1/id").asText();

        get(PUBLIC + "/" + id + "/lessons/" + a1, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lesson.content").value("Body of A1"))
                .andExpect(jsonPath("$.data.chapters.length()").value(2))
                .andExpect(jsonPath("$.data.chapters[0].lessons[1].content").doesNotExist())
                .andExpect(jsonPath("$.data.learning").value(nullValue()));
        get(PUBLIC + "/" + id + "/lessons/" + a2, null).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("LESSON_PREVIEW_ONLY"))
                .andExpect(jsonPath("$.data").doesNotExist());
        get(PUBLIC + "/" + id + "/lessons/" + a2, learnerToken).andExpect(jsonPath("$.code").value("LESSON_PREVIEW_ONLY"));
        get(PUBLIC + "/" + id + "/lessons/" + UUID.randomUUID(), null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LESSON_NOT_FOUND"));
        // Owner and managers read like guests.
        get(PUBLIC + "/" + id, authorToken).andExpect(jsonPath("$.data.viewer.canStart").value(false));
        get(PUBLIC + "/" + id, modToken).andExpect(jsonPath("$.data.viewer.canStart").value(false));
        get(PUBLIC + "/" + id + "/lessons/" + a1, modToken).andExpect(status().isOk());
    }

    @Test
    void hiddenRemovedAndSuspendedCoursesAre404AndLeaveTheList() throws Exception {
        String hidden = publishedCourse("Hidden");
        String removed = publishedCourse("Removed");
        String authorHidden = publishedCourse("Author hidden");
        publication(hidden, "HIDE", "Spam").andExpect(status().isOk());
        publication(removed, "REMOVE", "Policy").andExpect(status().isOk());
        send(patch(AUTHOR + "/" + authorHidden + "/publication"), authorToken, Map.of("action", "HIDE"))
                .andExpect(status().isOk());
        for (String id : List.of(hidden, removed, authorHidden))
            get(PUBLIC + "/" + id, learnerToken).andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        get(PUBLIC, null).andExpect(jsonPath("$.data.totalElements").value(0));

        publication(hidden, "RESTORE", null).andExpect(status().isOk());
        get(PUBLIC, null).andExpect(jsonPath("$.data.content[*].id", contains(hidden)));
        jdbc.update("UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        get(PUBLIC + "/" + hidden, null).andExpect(status().isNotFound());
        get(PUBLIC, null).andExpect(jsonPath("$.data.totalElements").value(0));
        jdbc.update("UPDATE techverse.author_profiles SET status='APPROVED' WHERE user_id=?", author);
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", author);
        get(PUBLIC + "/" + hidden, null).andExpect(status().isNotFound());
    }

    @Test
    void optionsAreAnonymousAndListOnlyTaxonomyOfVisibleCourses() throws Exception {
        jdbc.update("INSERT INTO techverse.topics(name) VALUES ('Unused topic')");
        jdbc.update("INSERT INTO techverse.tags(name) VALUES ('Unused tag')");
        get(PUBLIC + "/options", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.content.length()").value(0))
                .andExpect(jsonPath("$.data.tags.content.length()").value(0));
        String id = publishedCourse("Options");
        get(PUBLIC + "/options", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.content[*].name", contains("Backend")))
                .andExpect(jsonPath("$.data.tags.content[*].name", contains("Java")));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(PUBLIC + "/options").param("tagKeyword", "zzz"))
                .andExpect(jsonPath("$.data.tags.content.length()").value(0))
                .andExpect(jsonPath("$.data.topics.content.length()").value(1));
        publication(id, "HIDE", "Spam").andExpect(status().isOk());
        get(PUBLIC + "/options", null).andExpect(jsonPath("$.data.topics.content.length()").value(0));
        get(PUBLIC + "/options?topicSize=101", null).andExpect(status().isBadRequest());
    }
}
