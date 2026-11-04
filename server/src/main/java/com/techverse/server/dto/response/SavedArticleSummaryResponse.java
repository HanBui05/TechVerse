package com.techverse.server.dto.response;

import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Public summary of a saved visible snapshot plus when the actor saved it. */
@Builder
public record SavedArticleSummaryResponse(
        UUID id,
        String title,
        String summary,
        String coverImageUrl,
        ArticleAuthorResponse author,
        ArticleTaxonomyResponse topic,
        List<ArticleTaxonomyResponse> tags,
        Instant publishedAt,
        Instant approvedAt,
        int versionNumber,
        int readingMinutes,
        boolean saved,
        Instant savedAt) {}
