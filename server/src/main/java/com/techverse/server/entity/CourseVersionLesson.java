package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "course_publication_version_lessons")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseVersionLesson extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "version_id", nullable = false, updatable = false)
    private CoursePublicationVersion version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "version_chapter_id", nullable = false, updatable = false)
    private CourseVersionChapter versionChapter;

    /** Stable lesson ID that progress and enrollments reference. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lesson_id", nullable = false, updatable = false)
    private Lesson lesson;

    @Column(nullable = false, length = 255, updatable = false)
    private String title;

    @Column(length = 500, updatable = false)
    private String summary;

    @Column(columnDefinition = "text", updatable = false)
    private String content;

    @Column(name = "video_provider", length = 20, updatable = false)
    private String videoProvider;

    @Column(name = "video_id", length = 11, updatable = false)
    private String videoId;

    @Column(name = "is_preview", nullable = false, updatable = false)
    private boolean preview;

    @Column(nullable = false, updatable = false)
    private int position;

    @Column(name = "content_fingerprint", nullable = false, length = 64, updatable = false)
    private String contentFingerprint;

    @Column(name = "ai_assisted", nullable = false, updatable = false)
    private boolean aiAssisted;

    CourseVersionLesson(CoursePublicationVersion version, CourseVersionChapter versionChapter, Lesson l) {
        this.version = version;
        this.versionChapter = versionChapter;
        this.lesson = l;
        this.title = l.getTitle();
        this.summary = l.getSummary();
        this.content = l.getContent();
        this.videoProvider = l.getVideoProvider();
        this.videoId = l.getVideoId();
        this.preview = l.isPreview();
        this.position = l.getPosition();
        this.contentFingerprint = l.getContentFingerprint();
        this.aiAssisted = l.isAiAssisted();
    }
}
