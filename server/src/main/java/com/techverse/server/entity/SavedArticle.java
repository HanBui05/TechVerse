package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

/**
 * Reader bookmark on the V1 {@code saved_articles} table (unique user+article, FK cascade).
 * Rows are written by {@code SavedArticleRepository} native SQL so concurrent saves stay
 * idempotent; the entity exists for read queries.
 */
@Entity
@Table(
        name = "saved_articles",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uq_saved_articles_user_article",
                        columnNames = {"user_id", "article_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SavedArticle extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false, updatable = false)
    private Article article;
}
