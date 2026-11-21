package com.techverse.server.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.*;

/** Forum views. A deleted question that is still shown has no title, content or author. */
public final class ForumResponse {
    private ForumResponse() {}

    public record PostViewer(boolean canEdit, boolean canDelete, boolean canReport) {}

    public record QuestionViewer(boolean canEdit, boolean canDelete, boolean canReport, boolean canAccept, boolean canAnswer) {}

    public record Summary(
            UUID id,
            String title,
            String excerpt,
            ArticleOptionResponse topic,
            ArticleAuthorResponse author,
            long answerCount,
            boolean solved,
            Instant createdAt,
            Instant editedAt) {}

    public record Answer(
            UUID id, String content, ArticleAuthorResponse author, boolean accepted, Instant createdAt, Instant editedAt, PostViewer viewer) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Question(
            UUID id,
            String title,
            String content,
            ArticleOptionResponse topic,
            ArticleAuthorResponse author,
            boolean deleted,
            boolean solved,
            UUID acceptedAnswerId,
            long answerCount,
            Instant createdAt,
            Instant editedAt,
            QuestionViewer viewer,
            List<Answer> answers) {}
}
