package com.techverse.server.dto.response;

import lombok.Builder;

@Builder
public record ArticleOptionsResponse(
        PageResponse<ArticleOptionResponse> topics, PageResponse<ArticleOptionResponse> tags) {}
