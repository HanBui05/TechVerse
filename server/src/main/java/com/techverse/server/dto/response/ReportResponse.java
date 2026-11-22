package com.techverse.server.dto.response;

import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.UUID;

/** Report views. Post content is read at view time, not copied when the report was made. */
public final class ReportResponse {
    private ReportResponse() {}

    public record Created(UUID id, ReportStatus status, Instant createdAt) {}

    /**
     * A forum post as moderators see it. {@code type} is QUESTION or ANSWER; {@code publiclyVisible} means readers can
     * open it (the post and, for an answer, its question are not hidden or gone).
     */
    public record ModeratedPost(
            UUID id,
            String type,
            UUID questionId,
            String questionTitle,
            String content,
            ArticleAuthorResponse author,
            ForumPostStatus status,
            boolean publiclyVisible,
            String moderationNote,
            ArticleAuthorResponse hiddenBy,
            Instant hiddenAt) {}

    /** A conversation as moderators see it: who takes part and its block/lock state, never its messages. */
    public record ModeratedConversation(
            UUID id,
            ArticleAuthorResponse learner,
            ArticleAuthorResponse author,
            boolean blocked,
            boolean locked,
            String lockNote,
            ArticleAuthorResponse lockedBy,
            Instant lockedAt) {}

    /** Exactly one of {@code post} and {@code conversation} is set, by {@code targetType}. */
    public record Item(
            UUID id,
            String targetType,
            ReportReason reason,
            String description,
            ReportStatus status,
            ArticleAuthorResponse reporter,
            Instant createdAt,
            Instant handledAt,
            String resolutionNote,
            ModeratedPost post,
            ModeratedConversation conversation,
            long otherOpenReports) {}
}
