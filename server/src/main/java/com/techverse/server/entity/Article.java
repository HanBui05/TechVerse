package com.techverse.server.entity;

import com.techverse.server.enums.ArticleStatus;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "articles")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Article extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false)
    private Topic topic;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "cover_image_url", columnDefinition = "text")
    private String coverImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ArticleStatus status;

    @Column(name = "moderation_note", columnDefinition = "text")
    private String moderationNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @OneToMany(mappedBy = "article", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ArticleTag> articleTags = new ArrayList<>();

    @Builder
    private Article(User author, Topic topic, String title, String summary, String content) {
        this.author = author;
        this.topic = topic;
        this.title = title;
        this.summary = summary;
        this.content = content;
        this.status = ArticleStatus.DRAFT;
    }

    public boolean isEditable() {
        return status == ArticleStatus.DRAFT || status == ArticleStatus.CHANGES_REQUESTED;
    }

    public void edit(
            Topic topic, String title, String summary, String content, String coverImageUrl) {
        this.topic = topic;
        this.title = title;
        this.summary = summary;
        this.content = content;
        this.coverImageUrl = coverImageUrl;
    }

    public void replaceTags(List<Tag> selected) {
        Set<UUID> ids = new HashSet<>();
        selected.forEach(t -> ids.add(t.getId()));
        articleTags.removeIf(link -> !ids.contains(link.getTag().getId()));
        Set<UUID> existing = new HashSet<>();
        articleTags.forEach(link -> existing.add(link.getTag().getId()));
        selected.stream()
                .filter(t -> !existing.contains(t.getId()))
                .forEach(t -> articleTags.add(ArticleTag.builder().article(this).tag(t).build()));
    }

    public void submit() {
        this.status = ArticleStatus.PENDING;
    }

    public void review(ArticleStatus decision, User reviewer, String note, Instant at) {
        if (status != ArticleStatus.PENDING
                || (decision != ArticleStatus.PUBLISHED && decision != ArticleStatus.CHANGES_REQUESTED)) {
            throw new IllegalStateException("Invalid article review transition");
        }
        this.status = decision;
        this.reviewedBy = reviewer;
        this.moderationNote = note;
        this.reviewedAt = at;
        if (decision == ArticleStatus.PUBLISHED) this.publishedAt = at;
    }
}
