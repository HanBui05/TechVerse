package com.techverse.server.dto.response;

import com.techverse.server.enums.CourseChangeStatus;

import java.util.List;
import java.util.UUID;

/**
 * Working and published trees (no lesson content), the review token for the current submission and
 * a diff tree: working active nodes in order, then nodes only the latest version has (ARCHIVED).
 */
public record ModeratorCourseDetailResponse(
        CourseResponse course,
        ArticleAuthorResponse author,
        String reviewToken,
        boolean authorEligible,
        List<CourseModerationHistoryResponse> history,
        List<ChangeChapter> changes) {
    public record ChangeChapter(UUID id, String title, CourseChangeStatus changeStatus, List<ChangeLesson> lessons) {}

    public record ChangeLesson(UUID id, String title, CourseChangeStatus changeStatus) {}
}
