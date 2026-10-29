package com.techverse.server.dto.response;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record RelatedArticleResponse(
        UUID id, String title, String coverImageUrl, Instant publishedAt) {}
