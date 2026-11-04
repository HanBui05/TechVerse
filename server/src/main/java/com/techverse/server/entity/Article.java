package com.techverse.server.entity;

import static com.techverse.server.enums.ArticlePublicationStatus.*;

import com.techverse.server.enums.*;
import com.techverse.server.exception.*;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.Formula;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * Author's working copy plus a pointer to the immutable snapshot readers see. Every state change
 * goes through a method below; invalid transitions throw before mutating anything.
 */
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
    @Column(name = "workflow_status", nullable = false, length = 30)
    private ArticleWorkflowStatus workflowStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "publication_status", nullable = false, length = 30)
    private ArticlePublicationStatus publicationStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "hidden_from_publication_status", length = 30)
    private ArticlePublicationStatus hiddenFromPublicationStatus;

    @ManyToOne(fetch = FetchType.LAZY, cascade = CascadeType.PERSIST)
    @JoinColumn(name = "published_version_id")
    private ArticlePublicationVersion publishedVersion;

    @Column(name = "content_fingerprint", nullable = false, length = 64)
    private String contentFingerprint;

    /** Read-only copy for list queries: compares fingerprints without loading snapshot content. */
    @Formula(
            "(select v.content_fingerprint from techverse.article_publication_versions v"
                    + " where v.id = published_version_id)")
    private String publishedFingerprint;

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
        this.workflowStatus = ArticleWorkflowStatus.DRAFT;
        this.publicationStatus = UNPUBLISHED;
        this.contentFingerprint = computeFingerprint();
    }

    // ------------------------------------------------------------------ working copy

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

    public void ensureEditable() {
        if (publicationStatus.isTerminal() || workflowStatus == ArticleWorkflowStatus.PENDING)
            throw new CustomException(ErrorCode.ARTICLE_NOT_EDITABLE);
    }

    /** Records edited fields; returns false when nothing changed (no-op, state kept). */
    public boolean save() {
        ensureEditable();
        String fingerprint = computeFingerprint();
        if (fingerprint.equals(contentFingerprint)) return false;
        contentFingerprint = fingerprint;
        if (workflowStatus == ArticleWorkflowStatus.PUBLISHED)
            workflowStatus = ArticleWorkflowStatus.DRAFT;
        return true;
    }

    public void submit() {
        ensureEditable();
        String fingerprint = computeFingerprint();
        if (publishedVersion != null
                && fingerprint.equals(publishedVersion.getContentFingerprint()))
            throw new CustomException(ErrorCode.ARTICLE_NO_CHANGES);
        contentFingerprint = fingerprint;
        workflowStatus = ArticleWorkflowStatus.PENDING;
    }

    public void withdraw() {
        if (publicationStatus.isTerminal() || workflowStatus != ArticleWorkflowStatus.PENDING)
            throw new CustomException(ErrorCode.ARTICLE_NOT_WITHDRAWABLE);
        workflowStatus = ArticleWorkflowStatus.DRAFT;
    }

    public void discard() {
        if (publishedVersion == null
                || publicationStatus.isTerminal()
                || (workflowStatus != ArticleWorkflowStatus.DRAFT
                        && workflowStatus != ArticleWorkflowStatus.CHANGES_REQUESTED))
            throw new CustomException(ErrorCode.ARTICLE_NOT_DISCARDABLE);
        var v = publishedVersion;
        edit(v.getTopic(), v.getTitle(), v.getSummary(), v.getContent(), v.getCoverImageUrl());
        replaceTags(v.getTags().stream().map(ArticlePublicationVersionTag::getTag).toList());
        contentFingerprint = v.getContentFingerprint();
        workflowStatus = ArticleWorkflowStatus.PUBLISHED;
    }

    public boolean hasUnpublishedChanges() {
        if (publishedVersion == null) return false;
        // Lists must not load snapshot content: use the formula unless the snapshot is in memory.
        String published =
                org.hibernate.Hibernate.isInitialized(publishedVersion)
                        ? publishedVersion.getContentFingerprint()
                        : publishedFingerprint;
        return published != null && !published.equals(contentFingerprint);
    }

    // ------------------------------------------------------------------ author publication

    public ArticleModerationHistory authorHide(User actor) {
        if (publicationStatus != PUBLISHED) transitionInvalid();
        return transition(actor, ArticleModerationAction.AUTHOR_HIDE, null, AUTHOR_HIDDEN);
    }

    public ArticleModerationHistory authorUnhide(User actor) {
        if (publicationStatus == HIDDEN)
            throw new CustomException(ErrorCode.ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED);
        if (publicationStatus != AUTHOR_HIDDEN) transitionInvalid();
        return transition(actor, ArticleModerationAction.AUTHOR_UNHIDE, null, PUBLISHED);
    }

    /** Never-published drafts are deleted outright; anything with a snapshot is soft-deleted. */
    public boolean isHardDeletable() {
        return publishedVersion == null
                && publicationStatus == UNPUBLISHED
                && (workflowStatus == ArticleWorkflowStatus.DRAFT
                        || workflowStatus == ArticleWorkflowStatus.CHANGES_REQUESTED);
    }

    public ArticleModerationHistory softDelete(User actor) {
        if (publishedVersion == null || publicationStatus.isTerminal())
            throw new CustomException(ErrorCode.ARTICLE_NOT_DELETABLE);
        hiddenFromPublicationStatus = null;
        return transition(actor, ArticleModerationAction.AUTHOR_DELETE, null, AUTHOR_DELETED);
    }

    // ------------------------------------------------------------------ moderation

    public ArticleModerationHistory approve(
            User reviewer, String note, Instant at, int readingMinutes) {
        checkReviewable();
        var fromWorkflow = workflowStatus;
        var fromPublication = publicationStatus;
        int next = publishedVersion == null ? 1 : publishedVersion.getVersionNumber() + 1;
        publishedVersion =
                ArticlePublicationVersion.snapshot(this, next, reviewer, at, readingMinutes);
        if (publicationStatus == UNPUBLISHED) {
            publicationStatus = PUBLISHED;
            publishedAt = at;
        } else if (publicationStatus == HIDDEN) {
            publicationStatus = hiddenFromPublicationStatus;
            hiddenFromPublicationStatus = null;
        }
        workflowStatus = ArticleWorkflowStatus.PUBLISHED;
        review(reviewer, note, at);
        return ArticleModerationHistory.of(
                this, reviewer, ArticleModerationAction.APPROVE, note, fromWorkflow, fromPublication);
    }

    public ArticleModerationHistory requestChanges(User reviewer, String note, Instant at) {
        checkReviewable();
        var fromWorkflow = workflowStatus;
        workflowStatus = ArticleWorkflowStatus.CHANGES_REQUESTED;
        review(reviewer, note, at);
        return ArticleModerationHistory.of(
                this,
                reviewer,
                ArticleModerationAction.REQUEST_CHANGES,
                note,
                fromWorkflow,
                publicationStatus);
    }

    public ArticleModerationHistory moderatorHide(User actor, String note) {
        if (publicationStatus != PUBLISHED && publicationStatus != AUTHOR_HIDDEN)
            transitionInvalid();
        var source = publicationStatus;
        var history = transition(actor, ArticleModerationAction.HIDE, note, HIDDEN);
        hiddenFromPublicationStatus = source;
        return history;
    }

    public ArticleModerationHistory restore(User actor, String note) {
        if (publicationStatus != HIDDEN) transitionInvalid();
        var target = hiddenFromPublicationStatus;
        hiddenFromPublicationStatus = null;
        return transition(actor, ArticleModerationAction.RESTORE, note, target);
    }

    public ArticleModerationHistory remove(User actor, String note) {
        if (publicationStatus != PUBLISHED
                && publicationStatus != AUTHOR_HIDDEN
                && publicationStatus != HIDDEN) transitionInvalid();
        hiddenFromPublicationStatus = null;
        return transition(actor, ArticleModerationAction.REMOVE, note, REMOVED);
    }

    private void checkReviewable() {
        if (publicationStatus.isTerminal()) transitionInvalid();
        if (workflowStatus != ArticleWorkflowStatus.PENDING)
            throw new CustomException(ErrorCode.ARTICLE_NOT_PENDING);
    }

    private void review(User reviewer, String note, Instant at) {
        reviewedBy = reviewer;
        reviewedAt = at;
        moderationNote = note;
    }

    private ArticleModerationHistory transition(
            User actor, ArticleModerationAction action, String note, ArticlePublicationStatus to) {
        var from = publicationStatus;
        publicationStatus = to;
        return ArticleModerationHistory.of(this, actor, action, note, workflowStatus, from);
    }

    private static void transitionInvalid() {
        throw new CustomException(ErrorCode.ARTICLE_PUBLICATION_TRANSITION_INVALID);
    }

    // ------------------------------------------------------------------ fingerprint

    public String computeFingerprint() {
        return fingerprint(
                title,
                summary,
                content,
                coverImageUrl,
                topic.getId(),
                articleTags.stream().map(t -> t.getTag().getId()).toList());
    }

    /** SHA-256 over length-prefixed UTF-8 fields; null (-1) differs from empty (0). */
    public static String fingerprint(
            String title,
            String summary,
            String content,
            String coverImageUrl,
            UUID topicId,
            Collection<UUID> tagIds) {
        var out = new ByteArrayOutputStream();
        var fields = new ArrayList<String>();
        fields.addAll(
                Arrays.asList(
                        title,
                        summary,
                        content,
                        coverImageUrl,
                        topicId == null ? null : topicId.toString()));
        tagIds.stream().map(UUID::toString).sorted().forEach(fields::add);
        for (String field : fields) {
            byte[] bytes = field == null ? new byte[0] : field.getBytes(StandardCharsets.UTF_8);
            out.writeBytes(ByteBuffer.allocate(4).putInt(field == null ? -1 : bytes.length).array());
            out.writeBytes(bytes);
        }
        try {
            return HexFormat.of()
                    .formatHex(MessageDigest.getInstance("SHA-256").digest(out.toByteArray()));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
