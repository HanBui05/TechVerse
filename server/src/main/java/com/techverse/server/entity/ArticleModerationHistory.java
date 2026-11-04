package com.techverse.server.entity;

import com.techverse.server.enums.*;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.Immutable;

/** Append-only audit of review/publication actions (UPDATE rejected by a DB trigger). */
@Entity
@Immutable
@Table(name = "article_moderation_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ArticleModerationHistory extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false, updatable = false)
    private Article article;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", updatable = false)
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30, updatable = false)
    private ArticleModerationAction action;

    @Column(columnDefinition = "text", updatable = false)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_workflow_status", nullable = false, length = 30, updatable = false)
    private ArticleWorkflowStatus fromWorkflowStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_workflow_status", nullable = false, length = 30, updatable = false)
    private ArticleWorkflowStatus toWorkflowStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_publication_status", nullable = false, length = 30, updatable = false)
    private ArticlePublicationStatus fromPublicationStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_publication_status", nullable = false, length = 30, updatable = false)
    private ArticlePublicationStatus toPublicationStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "version_id", updatable = false)
    private ArticlePublicationVersion version;

    static ArticleModerationHistory of(
            Article article,
            User actor,
            ArticleModerationAction action,
            String note,
            ArticleWorkflowStatus fromWorkflow,
            ArticlePublicationStatus fromPublication) {
        var h = new ArticleModerationHistory();
        h.article = article;
        h.actor = actor;
        h.action = action;
        h.note = note;
        h.fromWorkflowStatus = fromWorkflow;
        h.toWorkflowStatus = article.getWorkflowStatus();
        h.fromPublicationStatus = fromPublication;
        h.toPublicationStatus = article.getPublicationStatus();
        h.version = article.getPublishedVersion();
        return h;
    }
}
