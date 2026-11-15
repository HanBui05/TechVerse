package com.techverse.server.dto.internal;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

/**
 * shortcut: {@code articleId} is the owning document ID (article, course or lesson per {@code
 * scope}); rename when a non-article caller outgrows it. {@code parentId} is the course of a LESSON.
 */
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
        boolean retiring,
        Scope scope,
        UUID parentId) {
    public enum Scope {
        ARTICLE,
        COURSE,
        LESSON
    }

    /** Assets stored before scopes existed are article images. */
    public Scope effectiveScope() {
        return scope == null ? Scope.ARTICLE : scope;
    }
}
