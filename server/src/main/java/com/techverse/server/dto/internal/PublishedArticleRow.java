package com.techverse.server.dto.internal;

import com.techverse.server.dto.response.ArticleAuthorResponse;
import com.techverse.server.dto.response.ArticleTaxonomyResponse;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

/** Scalar read model: content is selected only for the single-article detail query. */
@Builder
public record PublishedArticleRow(
        UUID id,
        String title,
        String summary,
        String content,
        String coverImageUrl,
        ArticleAuthorResponse author,
        ArticleTaxonomyResponse topic,
        Instant publishedAt,
        Instant updatedAt) {}
