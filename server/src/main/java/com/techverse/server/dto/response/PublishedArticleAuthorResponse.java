package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.UUID;

/** Public author card; never contains email or account state. */
@Builder
public record PublishedArticleAuthorResponse(
        UUID id, String fullName, String avatarUrl, String expertise, String bioExcerpt) {
    static final int BIO_EXCERPT_CODE_POINTS = 300;

    /** Trimmed bio, at most 300 code points, never splitting a surrogate pair. */
    public static String excerpt(String bio) {
        if (bio == null) return null;
        String trimmed = bio.strip();
        if (trimmed.codePointCount(0, trimmed.length()) <= BIO_EXCERPT_CODE_POINTS) return trimmed;
        return trimmed.substring(0, trimmed.offsetByCodePoints(0, BIO_EXCERPT_CODE_POINTS));
    }
}
