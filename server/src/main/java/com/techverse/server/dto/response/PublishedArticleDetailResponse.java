package com.techverse.server.dto.response;

import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Builder
public record PublishedArticleDetailResponse(
        UUID id,
        String title,
        String summary,
        String content,
        String coverImageUrl,
        ArticleAuthorResponse author,
        ArticleTaxonomyResponse topic,
        List<ArticleTaxonomyResponse> tags,
        Instant publishedAt,
        Instant updatedAt,
        List<RelatedArticleResponse> relatedArticles) {}
