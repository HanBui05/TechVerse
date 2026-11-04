package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.*;

/** Approved snapshot readers see; never modified after insert (also enforced by a DB trigger). */
@Entity
@Immutable
@Table(name = "article_publication_versions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ArticlePublicationVersion extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false, updatable = false)
    private Article article;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    @Column(nullable = false, length = 255, updatable = false)
    private String title;

    @Column(nullable = false, length = 500, updatable = false)
    private String summary;

    @Column(nullable = false, columnDefinition = "text", updatable = false)
    private String content;

    @Column(name = "cover_image_url", columnDefinition = "text", updatable = false)
    private String coverImageUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false, updatable = false)
    private Topic topic;

    @Column(name = "content_fingerprint", nullable = false, length = 64, updatable = false)
    private String contentFingerprint;

    @Column(name = "reading_minutes", nullable = false, updatable = false)
    private int readingMinutes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by", updatable = false)
    private User approvedBy;

    @Column(name = "approved_at", nullable = false, updatable = false)
    private Instant approvedAt;

    @OneToMany(mappedBy = "version", cascade = CascadeType.PERSIST)
    @OrderBy("id ASC")
    private List<ArticlePublicationVersionTag> tags = new ArrayList<>();

    /** Copies the article's current working copy. */
    static ArticlePublicationVersion snapshot(
            Article a, int number, User approver, Instant at, int readingMinutes) {
        var v = new ArticlePublicationVersion();
        v.article = a;
        v.versionNumber = number;
        v.title = a.getTitle();
        v.summary = a.getSummary();
        v.content = a.getContent();
        v.coverImageUrl = a.getCoverImageUrl();
        v.topic = a.getTopic();
        v.contentFingerprint = a.getContentFingerprint();
        v.readingMinutes = readingMinutes;
        v.approvedBy = approver;
        v.approvedAt = at;
        a.getArticleTags().forEach(link -> v.tags.add(new ArticlePublicationVersionTag(v, link.getTag())));
        return v;
    }
}
