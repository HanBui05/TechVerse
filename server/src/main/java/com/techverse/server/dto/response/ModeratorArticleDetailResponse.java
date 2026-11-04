package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.List;

/** Working copy + {@code article.publishedVersion} for comparison, latest history and token. */
@Builder
public record ModeratorArticleDetailResponse(
        ArticleResponse article,
        ArticleAuthorResponse author,
        String reviewToken,
        boolean authorEligible,
        List<ArticleModerationHistoryResponse> history) {}
