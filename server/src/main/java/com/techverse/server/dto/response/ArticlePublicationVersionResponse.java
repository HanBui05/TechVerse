package com.techverse.server.dto.response;

import com.techverse.server.entity.ArticlePublicationVersion;

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
        int readingMinutes) {

    public static ArticlePublicationVersionResponse from(ArticlePublicationVersion v) {
        if (v == null) return null;
        var t = v.getTopic();
        return ArticlePublicationVersionResponse.builder()
                .id(v.getId())
                .versionNumber(v.getVersionNumber())
                .title(v.getTitle())
                .summary(v.getSummary())
                .content(v.getContent())
                .coverImageUrl(v.getCoverImageUrl())
                .topic(new ArticleOptionResponse(t.getId(), t.getName(), t.isActive()))
                .tags(
                        v.getTags().stream()
                                .map(link -> link.getTag())
                                .map(
                                        tag ->
                                                new ArticleOptionResponse(
                                                        tag.getId(), tag.getName(), tag.isActive()))
                                .toList())
                .approvedBy(v.getApprovedBy() == null ? null : v.getApprovedBy().getId())
                .approvedAt(v.getApprovedAt())
                .contentFingerprint(v.getContentFingerprint())
                .readingMinutes(v.getReadingMinutes())
                .build();
    }
}
