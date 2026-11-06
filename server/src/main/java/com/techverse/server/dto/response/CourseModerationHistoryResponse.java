package com.techverse.server.dto.response;

import com.techverse.server.entity.CourseModerationHistory;
import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.UUID;

public record CourseModerationHistoryResponse(
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
    public static CourseModerationHistoryResponse from(CourseModerationHistory h) {
        var actor = h.getActor();
        return new CourseModerationHistoryResponse(
                h.getId(),
                h.getAction(),
                h.getNote(),
                actor == null ? null : new ArticleAuthorResponse(actor.getId(), actor.getFullName(), actor.getAvatarUrl()),
                h.getFromWorkflowStatus(),
                h.getToWorkflowStatus(),
                h.getFromPublicationStatus(),
                h.getToPublicationStatus(),
                h.getVersion() == null ? null : h.getVersion().getVersionNumber(),
                h.getCreatedAt());
    }
}
