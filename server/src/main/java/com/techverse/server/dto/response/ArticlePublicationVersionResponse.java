package com.techverse.server.dto.response;

import lombok.Builder;

import java.time.Instant;
import java.util.*;

/** Immutable approved snapshot; topic/tag names resolve against current taxonomy. */
@Builder
public record ArticlePublicationVersionResponse(
        UUID id,
        int versionNumber,
        String title,
        String summary,
        String content,
        String coverImageUrl,
        ArticleOptionResponse topic,
        List<ArticleOptionResponse> tags,
        UUID approvedBy,
        Instant approvedAt,
        String contentFingerprint,
        int readingMinutes) {}
