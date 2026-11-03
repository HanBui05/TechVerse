package com.techverse.server.dto.internal;

import com.techverse.server.dto.response.ArticleAuthorResponse;
import com.techverse.server.dto.response.ArticleTaxonomyResponse;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

/** Scalar read model of a visible snapshot; content is selected only for detail. */
@Builder
public record PublishedArticleRow(
        UUID id,
        UUID versionId,
        String title,
        String summary,
        String content,
        String coverImageUrl,
        ArticleAuthorResponse author,
        ArticleTaxonomyResponse topic,
        Instant publishedAt,
        Instant approvedAt,
        int versionNumber,
        int readingMinutes,
        boolean saved) {}
