package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.test.web.servlet.ResultActions;

import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/** Real DB, security and Redis; the model is the shared mock. */
class LessonTutorIntegrationTest extends CourseIntegrationTestBase {
    @BeforeEach
    void model() {
        when(chatModel.stream(any(Prompt.class)))
                .thenReturn(Flux.just(new ChatResponse(List.of(new Generation(
                        new AssistantMessage("Trả lời"), ChatGenerationMetadata.builder().finishReason("STOP").build())))));
    }

    String lesson(String course, int chapter, int lesson) throws Exception {
        return data(get(PUBLIC + "/" + course, null)).at("/chapters/" + chapter + "/lessons/" + lesson + "/id").asText();
    }

    ResultActions ask(String course, String lesson, String token) throws Exception {
        return send(post(PUBLIC + "/" + course + "/lessons/" + lesson + "/tutor:stream"), token, Map.of("question", "Bài này nói gì?"));
    }

    int enrollments() {
        return jdbc.queryForObject("SELECT count(*) FROM techverse.course_enrollments", Integer.class);
    }

    @Test
    void enrolledLearnerAsksAboutAnyLessonWithoutTouchingProgress() throws Exception {
        String id = publishedCourse("Tutor");
        send(post(PUBLIC + "/" + id + "/start"), learnerToken, Map.of()).andExpect(status().isOk());

        ask(id, lesson(id, 0, 1), learnerToken)
                .andExpect(request().asyncStarted())
                .andExpect(header().string("X-AI-Quota-Limit", "20"))
                .andExpect(header().string("X-AI-Quota-Remaining", "19"));
        assertThat(jdbc.queryForObject("SELECT last_lesson_id FROM techverse.course_enrollments", Object.class)).isNull();
        get("/api/v1/me/ai-tutor/quota", learnerToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.remaining").value(19));
    }

    @Test
    void signedInReaderAsksAboutPreviewLessonWithoutEnrolling() throws Exception {
        String id = publishedCourse("Preview");

        ask(id, lesson(id, 0, 0), learnerToken).andExpect(request().asyncStarted());
        assertThat(enrollments()).isZero();
    }

    @Test
    void freeCourseNotStartedRejectsNonPreviewLessonAndCreatesNoEnrollment() throws Exception {
        String id = publishedCourse("Free");

        ask(id, lesson(id, 0, 1), learnerToken)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("LESSON_PREVIEW_ONLY"));
        assertThat(enrollments()).isZero();
        get("/api/v1/me/ai-tutor/quota", learnerToken).andExpect(jsonPath("$.data.remaining").value(20));
    }

    @Test
    void paidCourseNotBoughtRequiresPurchase() throws Exception {
        String id = publishedPaidCourse("Paid", 100_000);

        ask(id, lesson(id, 0, 1), learnerToken)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("COURSE_PURCHASE_REQUIRED"));
    }

    @Test
    void adminAndAnonymousAreRejectedEvenOnPreviewLessons() throws Exception {
        String id = publishedCourse("Staff");
        String preview = lesson(id, 0, 0);

        ask(id, preview, adminToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        ask(id, preview, null).andExpect(status().isUnauthorized());
    }
}
