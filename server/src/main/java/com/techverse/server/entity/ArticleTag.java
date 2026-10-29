package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

@Entity
@Table(
        name = "article_tags",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uq_article_tags_article_tag",
                        columnNames = {"article_id", "tag_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ArticleTag extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false)
    private Article article;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    @Builder
    private ArticleTag(Article article, Tag tag) {
        this.article = article;
        this.tag = tag;
    }
}
