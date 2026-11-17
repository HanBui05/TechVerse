package com.techverse.server.dto.response;

import com.techverse.server.entity.Course;
import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.UUID;

/** Queue row: working summary (no money fields), author card and whether the author may still publish. */
public record ModeratorCourseSummaryResponse(Item course, ArticleAuthorResponse author, boolean authorEligible) {
    public record Item(
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
        public static Item from(Course c) {
            return new Item(
                    c.getId(), c.getTitle(), c.getSummary(), c.getCoverImageUrl(), c.getLevel(),
                    CourseResponse.option(c.getTopic()), c.getWorkflowStatus(), c.getPublicationStatus(),
                    c.hasUnpublishedChanges(), c.getPublishedAt(), c.getCreatedAt(), c.getUpdatedAt());
        }
    }
}
