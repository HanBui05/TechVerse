package com.techverse.server.dto.response;

import java.util.List;
import java.util.UUID;

/** One snapshot lesson with the course curriculum; other lessons' content is never included. */
public record PublishedLessonResponse(
        UUID courseId,
        String courseTitle,
        Lesson lesson,
        List<PublishedCourseDetailResponse.Chapter> chapters,
        PublishedCourseDetailResponse.Viewer viewer,
        CourseProgressResponse learning) {
    public record Lesson(
            UUID id,
            UUID chapterId,
            String title,
            String summary,
            String content,
            LessonResponse.Video video,
            int position,
            boolean preview) {}
}
