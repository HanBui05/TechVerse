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
        long priceAmount,
        String currency,
        ArticleOptionResponse topic,
        ArticleWorkflowStatus workflowStatus,
        ArticlePublicationStatus publicationStatus,
        boolean hasUnpublishedChanges,
        long studentCount,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {
    public static CourseSummaryResponse from(Course c, long studentCount) {
        return new CourseSummaryResponse(
                c.getId(),
                c.getTitle(),
                c.getSummary(),
                c.getCoverImageUrl(),
                c.getLevel(),
                c.getPriceAmount(),
                "VND",
                CourseResponse.option(c.getTopic()),
                c.getWorkflowStatus(),
                c.getPublicationStatus(),
                c.hasUnpublishedChanges(),
                studentCount,
                c.getPublishedAt(),
                c.getCreatedAt(),
                c.getUpdatedAt());
    }
}
