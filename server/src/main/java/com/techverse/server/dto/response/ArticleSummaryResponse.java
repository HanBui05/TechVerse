package com.techverse.server.dto.response;

import com.techverse.server.enums.ArticleStatus;

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
        ArticleStatus status,
        Instant createdAt,
        Instant updatedAt) {}
