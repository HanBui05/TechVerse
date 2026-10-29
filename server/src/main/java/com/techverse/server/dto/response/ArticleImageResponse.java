package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.UUID;

@Builder
public record ArticleImageResponse(
        String url, String publicId, int width, int height, UUID uploadKey) {}
