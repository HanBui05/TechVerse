package com.techverse.server.dto.response;

import com.techverse.server.entity.Course;
import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.UUID;

public record CourseSummaryResponse(
        UUID id,
        String title,
        String summary,
        String coverImageUrl,
        CourseLevel level,
        ArticleOptionResponse topic,
        ArticleWorkflowStatus workflowStatus,
        ArticlePublicationStatus publicationStatus,
        boolean hasUnpublishedChanges,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {
    public static CourseSummaryResponse from(Course c) {
        return new CourseSummaryResponse(
                c.getId(),
                c.getTitle(),
                c.getSummary(),
                c.getCoverImageUrl(),
                c.getLevel(),
                CourseResponse.option(c.getTopic()),
                c.getWorkflowStatus(),
                c.getPublicationStatus(),
                c.hasUnpublishedChanges(),
                c.getPublishedAt(),
                c.getCreatedAt(),
                c.getUpdatedAt());
    }
}
