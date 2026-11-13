package com.techverse.server.entity;

import com.techverse.server.exception.*;
import com.techverse.server.service.impl.LessonVideoParser;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.*;

/** Working-copy lesson. Its ID is stable: progress, "continue learning" and snapshots point at it. */
@Entity
@Table(name = "lessons")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Lesson extends BaseEntity {
    static final String YOUTUBE = "YOUTUBE";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false, updatable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chapter_id", nullable = false, updatable = false)
    private CourseChapter chapter;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 500)
    private String summary;

    @Column(columnDefinition = "text")
    private String content;

    @Column(name = "video_provider", length = 20)
    private String videoProvider;

    @Column(name = "video_id", length = 11)
    private String videoId;

    @Column(name = "is_preview", nullable = false)
    private boolean preview;

    @Column(nullable = false)
    private int position;

    @Column(name = "content_fingerprint", nullable = false, length = 64)
    private String contentFingerprint;

    @Column(name = "ai_assisted", nullable = false)
    private boolean aiAssisted;

    @Column(name = "archived_at")
    private Instant archivedAt;

    Lesson(
            CourseChapter chapter,
            String title,
            String summary,
            String content,
            String videoUrl,
            boolean preview,
            int position) {
        this.course = chapter.getCourse();
        this.chapter = chapter;
        this.position = position;
        apply(title, summary, content, videoUrl, preview);
    }

    public boolean isActive() {
        return archivedAt == null;
    }

    /** Blank content counts as none; a lesson always keeps a video or content. */
    public void edit(String title, String summary, String content, String videoUrl, boolean preview) {
        course.ensureEditable();
        apply(title, summary, content, videoUrl, preview);
    }

    private void apply(String title, String summary, String content, String videoUrl, boolean preview) {
        String text = content == null || content.isBlank() ? null : content;
        String video = videoUrl == null || videoUrl.isBlank() ? null : LessonVideoParser.youtubeId(videoUrl);
        if (text == null && video == null) throw new CustomException(ErrorCode.LESSON_CONTENT_REQUIRED);
        this.title = title;
        this.summary = summary;
        this.content = text;
        this.videoProvider = video == null ? null : YOUTUBE;
        this.videoId = video;
        this.preview = preview;
        this.contentFingerprint =
                Article.digest(
                        Arrays.asList(title, summary, text, videoProvider, videoId, String.valueOf(preview)));
    }

    public void markAiAssisted() {
        aiAssisted = true;
    }

    void moveTo(int position) {
        this.position = position;
    }

    /** Copies the snapshot back verbatim (no re-parse), so fingerprints match the version. */
    void restore(CourseVersionLesson s) {
        title = s.getTitle();
        summary = s.getSummary();
        content = s.getContent();
        videoProvider = s.getVideoProvider();
        videoId = s.getVideoId();
        preview = s.isPreview();
        position = s.getPosition();
        contentFingerprint = s.getContentFingerprint();
        aiAssisted = s.isAiAssisted();
        archivedAt = null;
    }

    void archive(Instant at) {
        if (archivedAt == null) archivedAt = at;
    }
}
