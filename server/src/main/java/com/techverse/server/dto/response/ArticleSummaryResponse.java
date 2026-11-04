package com.techverse.server.dto.response;

import com.techverse.server.enums.*;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record ArticleSummaryResponse(
        UUID id,
        String title,
        String summary,
        String coverImageUrl,
        ArticleOptionResponse topic,
        ArticleWorkflowStatus workflowStatus,
        ArticlePublicationStatus publicationStatus,
        boolean hasUnpublishedChanges,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {}
