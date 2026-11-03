package com.techverse.server.dto.response;

import com.techverse.server.enums.*;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record ArticleModerationHistoryResponse(
        UUID id,
        ArticleModerationAction action,
        String note,
        ArticleAuthorResponse actor,
        ArticleWorkflowStatus fromWorkflowStatus,
        ArticleWorkflowStatus toWorkflowStatus,
        ArticlePublicationStatus fromPublicationStatus,
        ArticlePublicationStatus toPublicationStatus,
        Integer versionNumber,
        Instant createdAt) {}
