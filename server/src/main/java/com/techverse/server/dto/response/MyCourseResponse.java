package com.techverse.server.dto.response;

import java.time.Instant;

/** A visible course the learner has started, with progress against its current snapshot. */
public record MyCourseResponse(
        PublishedCourseSummaryResponse course,
        CourseProgressResponse.Progress progress,
        CourseProgressResponse.ContinueLesson continueLesson,
        Instant grantedAt,
        Instant lastAccessedAt) {}
