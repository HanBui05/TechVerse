package com.techverse.server.dto.internal;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder(toBuilder = true)
public record ArticleImageAsset(
        String assetId,
        String publicId,
        String url,
        UUID ownerId,
        UUID articleId,
        String fingerprint,
        int width,
        int height,
        Instant createdAt,
        Instant touchedAt,
        boolean retiring) {}
