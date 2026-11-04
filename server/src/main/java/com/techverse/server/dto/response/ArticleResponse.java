package com.techverse.server.dto.response;

import com.techverse.server.enums.*;

import lombok.Builder;

import java.time.Instant;
import java.util.*;

/** Working copy as seen by its author (and Moderator); never returned by public APIs. */
@Builder
public record ArticleResponse(
        UUID id,
        UUID authorId,
        String title,
        String summary,
        String content,
        String coverImageUrl,
        ArticleOptionResponse topic,
        List<ArticleOptionResponse> tags,
        ArticleWorkflowStatus workflowStatus,
        ArticlePublicationStatus publicationStatus,
        boolean hasUnpublishedChanges,
        ArticlePublicationVersionResponse publishedVersion,
        List<ArticleImageIssueResponse> imageIssues,
        String moderationNote,
        UUID reviewedBy,
        Instant reviewedAt,
        Instant publishedAt,
        Instant createdAt,
        UUID createdBy,
        Instant updatedAt,
        UUID updatedBy) {}
