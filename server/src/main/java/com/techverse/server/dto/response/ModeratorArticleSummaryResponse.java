package com.techverse.server.dto.response;

import com.techverse.server.enums.*;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record ModeratorArticleSummaryResponse(
        UUID id,
        String title,
        String summary,
        String coverImageUrl,
        ArticleAuthorResponse author,
        ArticleOptionResponse topic,
        ArticleWorkflowStatus workflowStatus,
        ArticlePublicationStatus publicationStatus,
        boolean hasUnpublishedChanges,
        boolean authorEligible,
        Instant createdAt,
        Instant updatedAt) {}
