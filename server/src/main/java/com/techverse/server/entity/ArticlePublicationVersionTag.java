package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "article_publication_version_tags")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ArticlePublicationVersionTag extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "version_id", nullable = false, updatable = false)
    private ArticlePublicationVersion version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false, updatable = false)
    private Tag tag;

    ArticlePublicationVersionTag(ArticlePublicationVersion version, Tag tag) {
        this.version = version;
        this.tag = tag;
    }
}
