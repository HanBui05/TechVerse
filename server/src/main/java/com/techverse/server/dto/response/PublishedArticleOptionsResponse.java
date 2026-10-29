package com.techverse.server.dto.response;

import lombok.Builder;

@Builder
public record PublishedArticleOptionsResponse(
        PageResponse<ArticleTaxonomyResponse> topics, PageResponse<ArticleTaxonomyResponse> tags) {}
