package com.techverse.server.dto.response;

import com.techverse.server.entity.InterviewQuestion;
import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.UUID;

/** Author view: full content, moderation note and the version to send back on save. */
public record InterviewQuestionResponse(
        UUID id,
        ArticleOptionResponse topic,
        InterviewLevel level,
        String question,
        String sampleAnswer,
        String hint,
        InterviewStatus status,
        boolean aiAssisted,
        int version,
        String moderationNote,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {

    public record Moderated(InterviewQuestionResponse question, ArticleAuthorResponse author, boolean authorEligible, String reviewToken) {}

    /** Public view: deliberately has no hint or sample answer fields. {@code viewer} is null for guests. */
    public record Published(
            UUID id,
            ArticleOptionResponse topic,
            InterviewLevel level,
            String question,
            ArticleAuthorResponse author,
            Instant publishedAt,
            boolean hasHint,
            Viewer viewer) {}

    public record Viewer(boolean reviewed, boolean saved) {}

    public record Answer(String hint, String sampleAnswer) {}

    public static InterviewQuestionResponse of(InterviewQuestion q) {
        var t = q.getTopic();
        return new InterviewQuestionResponse(
                q.getId(), new ArticleOptionResponse(t.getId(), t.getName(), t.isActive()), q.getLevel(), q.getQuestion(),
                q.getSampleAnswer(), q.getHint(), q.getStatus(), q.isAiAssisted(), q.getVersion(), q.getModerationNote(),
                q.getPublishedAt(), q.getCreatedAt(), q.getUpdatedAt());
    }
}
