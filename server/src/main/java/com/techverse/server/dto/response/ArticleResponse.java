package com.techverse.server.dto.response;

import com.techverse.server.enums.ArticleStatus;

import lombok.Builder;

import java.time.Instant;
import java.util.*;

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
        ArticleStatus status,
        String moderationNote,
        UUID reviewedBy,
        Instant reviewedAt,
        Instant publishedAt,
        Instant createdAt,
        UUID createdBy,
        Instant updatedAt,
        UUID updatedBy) {}
