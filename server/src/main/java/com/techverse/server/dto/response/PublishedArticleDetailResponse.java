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
        PublishedArticleAuthorResponse author,
        ArticleTaxonomyResponse topic,
        List<ArticleTaxonomyResponse> tags,
        Instant publishedAt,
        Instant approvedAt,
        int versionNumber,
        int readingMinutes,
        List<RelatedArticleResponse> relatedArticles) {}
