package com.techverse.server.dto.response;

import com.techverse.server.entity.ArticleModerationHistory;
import com.techverse.server.enums.*;

import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record ArticleModerationHistoryResponse(
        UUID id,
        ArticleModerationAction action,
        String note,
        ArticleAuthorResponse actor,
        ArticleWorkflowStatus fromWorkflowStatus,
        ArticleWorkflowStatus toWorkflowStatus,
        ArticlePublicationStatus fromPublicationStatus,
        ArticlePublicationStatus toPublicationStatus,
        Integer versionNumber,
        Instant createdAt) {

    public static ArticleModerationHistoryResponse from(ArticleModerationHistory h) {
        var actor = h.getActor();
        return ArticleModerationHistoryResponse.builder()
                .id(h.getId())
                .action(h.getAction())
                .note(h.getNote())
                .actor(
                        actor == null
                                ? null
                                : new ArticleAuthorResponse(
                                        actor.getId(), actor.getFullName(), actor.getAvatarUrl()))
                .fromWorkflowStatus(h.getFromWorkflowStatus())
                .toWorkflowStatus(h.getToWorkflowStatus())
                .fromPublicationStatus(h.getFromPublicationStatus())
                .toPublicationStatus(h.getToPublicationStatus())
                .versionNumber(h.getVersion() == null ? null : h.getVersion().getVersionNumber())
                .createdAt(h.getCreatedAt())
                .build();
    }
}
