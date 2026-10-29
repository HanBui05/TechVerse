package com.techverse.server.dto.response;

import lombok.Builder;

@Builder
public record ModeratorArticleDetailResponse(
        ArticleResponse article, ArticleAuthorResponse author, String reviewToken) {}
