package com.techverse.server.dto.response;

import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** {@code publishedAt} is the first publication; {@code approvedAt} is this version's approval. */
@Builder
public record PublishedArticleSummaryResponse(
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
        boolean saved) {}
