package com.techverse.server.entity;

import static com.techverse.server.enums.ArticlePublicationStatus.*;

import com.techverse.server.enums.*;
import com.techverse.server.exception.*;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;
import java.util.*;

/**
 * Author's working copy of a free course (metadata, tags, chapters, lessons) plus a pointer to the
 * immutable snapshot learners see. Same two state axes as {@link Article}; price is fixed at 0 by the
 * database, so it is not mapped.
 */
@Entity
@Table(name = "courses")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Course extends BaseEntity {
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
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CourseLevel level;

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
    private CoursePublicationVersion publishedVersion;

    @Column(name = "content_fingerprint", nullable = false, length = 64)
    private String contentFingerprint;

    @Column(name = "moderation_note", columnDefinition = "text")
    private String moderationNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<CourseTag> courseTags = new ArrayList<>();

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<CourseChapter> chapters = new ArrayList<>();

    @Builder
    private Course(
            User author,
            Topic topic,
            String title,
            String summary,
            String description,
            CourseLevel level) {
        this.author = author;
        this.topic = topic;
        this.title = title;
        this.summary = summary;
        this.description = description;
        this.level = level;
        this.workflowStatus = ArticleWorkflowStatus.DRAFT;
        this.publicationStatus = UNPUBLISHED;
        this.contentFingerprint = computeFingerprint();
    }

    // ------------------------------------------------------------------ working copy

    public void edit(
            Topic topic,
            String title,
            String summary,
            String description,
            CourseLevel level,
            String coverImageUrl) {
        ensureEditable();
        this.topic = topic;
        this.title = title;
        this.summary = summary;
        this.description = description;
        this.level = level;
        this.coverImageUrl = coverImageUrl;
    }

    public void replaceTags(List<Tag> selected) {
        ensureEditable();
        Set<UUID> ids = new HashSet<>();
        selected.forEach(t -> ids.add(t.getId()));
        courseTags.removeIf(link -> !ids.contains(link.getTag().getId()));
        Set<UUID> existing = new HashSet<>();
        courseTags.forEach(link -> existing.add(link.getTag().getId()));
        selected.stream()
                .filter(t -> !existing.contains(t.getId()))
                .forEach(t -> courseTags.add(new CourseTag(this, t)));
    }

    public CourseChapter addChapter(String title, int position) {
        ensureEditable();
        var chapter = new CourseChapter(this, title, position);
        chapters.add(chapter);
        return chapter;
    }

    public Lesson addLesson(
            CourseChapter chapter,
            String title,
            String summary,
            String content,
            String videoUrl,
            boolean preview,
            int position) {
        ensureEditable();
        var lesson = new Lesson(chapter, title, summary, content, videoUrl, preview, position);
        chapter.getLessons().add(lesson);
        return lesson;
    }

    /** Deletes a lesson no snapshot has seen; otherwise archives it so its ID and progress survive. */
    public void removeLesson(Lesson lesson) {
        ensureEditable();
        if (!lesson.isActive()) return; // archived = published in an older version, never deleted
        if (inLatestSnapshot(lesson)) lesson.archive(Instant.now());
        else lesson.getChapter().getLessons().remove(lesson);
    }

    /** Same rule as {@link #removeLesson}; archiving a chapter archives its lessons too. */
    public void removeChapter(CourseChapter chapter) {
        ensureEditable();
        boolean seen =
                publishedVersion != null
                        && chapter.getId() != null
                        && publishedVersion.getChapters().stream()
                                .anyMatch(vc -> chapter.getId().equals(vc.getChapter().getId()));
        if (seen) {
            // Archived lessons were published in an older version, so only active unpublished ones go.
            chapter.getLessons().removeIf(l -> l.isActive() && !inLatestSnapshot(l));
            chapter.archive(Instant.now());
        } else chapters.remove(chapter);
    }

    public List<CourseChapter> activeChapters() {
        return chapters.stream()
                .filter(CourseChapter::isActive)
                .sorted(Comparator.comparingInt(CourseChapter::getPosition))
                .toList();
    }

    /** Lessons of the working copy in reading order. */
    public List<Lesson> activeLessons() {
        return activeChapters().stream().flatMap(c -> c.activeLessons().stream()).toList();
    }

    private boolean inLatestSnapshot(Lesson lesson) {
        return publishedVersion != null
                && lesson.getId() != null
                && publishedVersion.getLessons().stream()
                        .anyMatch(vl -> lesson.getId().equals(vl.getLesson().getId()));
    }

    public void ensureEditable() {
        if (publicationStatus.isTerminal() || workflowStatus == ArticleWorkflowStatus.PENDING)
            throw new CustomException(ErrorCode.COURSE_NOT_EDITABLE);
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
        var active = activeChapters();
        if (active.isEmpty() || active.stream().anyMatch(c -> c.activeLessons().isEmpty()))
            throw new CustomException(ErrorCode.COURSE_NOT_READY);
        String fingerprint = computeFingerprint();
        if (publishedVersion != null && fingerprint.equals(publishedVersion.getContentFingerprint()))
            throw new CustomException(ErrorCode.COURSE_NO_CHANGES);
        contentFingerprint = fingerprint;
        workflowStatus = ArticleWorkflowStatus.PENDING;
    }

    public void withdraw() {
        if (publicationStatus.isTerminal() || workflowStatus != ArticleWorkflowStatus.PENDING)
            throw new CustomException(ErrorCode.COURSE_NOT_WITHDRAWABLE);
        workflowStatus = ArticleWorkflowStatus.DRAFT;
    }

    public boolean hasUnpublishedChanges() {
        return publishedVersion != null
                && !publishedVersion.getContentFingerprint().equals(contentFingerprint);
    }

    // ------------------------------------------------------------------ moderation

    public CourseModerationHistory approve(User reviewer, String note, Instant at) {
        checkReviewable();
        var fromWorkflow = workflowStatus;
        var fromPublication = publicationStatus;
        int next = publishedVersion == null ? 1 : publishedVersion.getVersionNumber() + 1;
        publishedVersion = CoursePublicationVersion.snapshot(this, next, reviewer, at);
        if (publicationStatus == UNPUBLISHED) {
            publicationStatus = PUBLISHED;
            publishedAt = at;
        } else if (publicationStatus == HIDDEN) {
            publicationStatus = hiddenFromPublicationStatus;
            hiddenFromPublicationStatus = null;
        }
        workflowStatus = ArticleWorkflowStatus.PUBLISHED;
        review(reviewer, note, at);
        return CourseModerationHistory.of(
                this, reviewer, ArticleModerationAction.APPROVE, note, fromWorkflow, fromPublication);
    }

    public CourseModerationHistory requestChanges(User reviewer, String note, Instant at) {
        checkReviewable();
        var fromWorkflow = workflowStatus;
        workflowStatus = ArticleWorkflowStatus.CHANGES_REQUESTED;
        review(reviewer, note, at);
        return CourseModerationHistory.of(
                this,
                reviewer,
                ArticleModerationAction.REQUEST_CHANGES,
                note,
                fromWorkflow,
                publicationStatus);
    }

    private void checkReviewable() {
        if (publicationStatus.isTerminal())
            throw new CustomException(ErrorCode.COURSE_PUBLICATION_TRANSITION_INVALID);
        if (workflowStatus != ArticleWorkflowStatus.PENDING)
            throw new CustomException(ErrorCode.COURSE_NOT_PENDING);
    }

    private void review(User reviewer, String note, Instant at) {
        reviewedBy = reviewer;
        reviewedAt = at;
        moderationNote = note;
    }

    // ------------------------------------------------------------------ fingerprint

    /**
     * Covers metadata, tags and the active curriculum in reading order (lesson content via its own
     * fingerprint), so any curriculum edit shows up as an unpublished change.
     */
    public String computeFingerprint() {
        var fields = new ArrayList<String>();
        fields.addAll(
                Arrays.asList(
                        title,
                        summary,
                        description,
                        coverImageUrl,
                        topic.getId() == null ? null : topic.getId().toString(),
                        level == null ? null : level.name()));
        var tagIds = courseTags.stream().map(t -> t.getTag().getId().toString()).sorted().toList();
        fields.add(String.valueOf(tagIds.size()));
        fields.addAll(tagIds);
        for (CourseChapter chapter : activeChapters()) {
            // IDs are part of the snapshot: replacing a node by an identical new one changes stable IDs.
            fields.add("chapter");
            fields.add(String.valueOf(chapter.getId()));
            fields.add(chapter.getTitle());
            fields.add(String.valueOf(chapter.getPosition()));
            for (Lesson lesson : chapter.activeLessons()) {
                fields.add(String.valueOf(lesson.getId()));
                fields.add(String.valueOf(lesson.isAiAssisted()));
                fields.add(String.valueOf(lesson.getPosition()));
                fields.add(lesson.getContentFingerprint());
            }
        }
        return Article.digest(fields);
    }
}
