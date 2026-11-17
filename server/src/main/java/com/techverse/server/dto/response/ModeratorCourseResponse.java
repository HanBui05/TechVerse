package com.techverse.server.dto.response;

import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** {@link CourseResponse} without price, currency or commission: Moderators never receive money fields. */
public record ModeratorCourseResponse(
        UUID id,
        UUID authorId,
        String title,
        String summary,
        String description,
        CourseLevel level,
        String coverImageUrl,
        ArticleOptionResponse topic,
        List<ArticleOptionResponse> tags,
        ArticleWorkflowStatus workflowStatus,
        ArticlePublicationStatus publicationStatus,
        String fingerprint,
        boolean hasUnpublishedChanges,
        List<CourseResponse.Chapter> chapters,
        CourseResponse.Version publishedVersion,
        List<ArticleImageIssueResponse> imageIssues,
        String moderationNote,
        Instant reviewedAt,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {
    public static ModeratorCourseResponse from(CourseResponse c) {
        return new ModeratorCourseResponse(
                c.id(), c.authorId(), c.title(), c.summary(), c.description(), c.level(), c.coverImageUrl(), c.topic(),
                c.tags(), c.workflowStatus(), c.publicationStatus(), c.fingerprint(), c.hasUnpublishedChanges(),
                c.chapters(), c.publishedVersion(), c.imageIssues(), c.moderationNote(), c.reviewedAt(), c.publishedAt(),
                c.createdAt(), c.updatedAt());
    }
}
