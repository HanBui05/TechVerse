package com.techverse.server.entity;

import com.techverse.server.enums.CourseLevel;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.*;

/** Approved snapshot learners see (metadata, tags, chapters, lessons); append-only, trigger-enforced. */
@Entity
@Immutable
@Table(name = "course_publication_versions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CoursePublicationVersion extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false, updatable = false)
    private Course course;

    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;

    @Column(nullable = false, length = 255, updatable = false)
    private String title;

    @Column(nullable = false, length = 500, updatable = false)
    private String summary;

    @Column(nullable = false, columnDefinition = "text", updatable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private CourseLevel level;

    @Column(name = "cover_image_url", columnDefinition = "text", updatable = false)
    private String coverImageUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false, updatable = false)
    private Topic topic;

    @Column(name = "content_fingerprint", nullable = false, length = 64, updatable = false)
    private String contentFingerprint;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by", updatable = false)
    private User approvedBy;

    @Column(name = "approved_at", nullable = false, updatable = false)
    private Instant approvedAt;

    @OneToMany(mappedBy = "version", cascade = CascadeType.PERSIST)
    @OrderBy("id ASC")
    private List<CourseVersionTag> tags = new ArrayList<>();

    // Declared before lessons: Hibernate persists cascades in field order and lessons need their chapter row.
    @OneToMany(mappedBy = "version", cascade = CascadeType.PERSIST)
    @OrderBy("position ASC")
    private List<CourseVersionChapter> chapters = new ArrayList<>();

    @OneToMany(mappedBy = "version", cascade = CascadeType.PERSIST)
    @OrderBy("id ASC")
    private List<CourseVersionLesson> lessons = new ArrayList<>();

    /** Copies the course's working copy, active chapters and lessons only. */
    static CoursePublicationVersion snapshot(Course c, int number, User approver, Instant at) {
        var v = new CoursePublicationVersion();
        v.course = c;
        v.versionNumber = number;
        v.title = c.getTitle();
        v.summary = c.getSummary();
        v.description = c.getDescription();
        v.level = c.getLevel();
        v.coverImageUrl = c.getCoverImageUrl();
        v.topic = c.getTopic();
        v.contentFingerprint = c.getContentFingerprint();
        v.approvedBy = approver;
        v.approvedAt = at;
        c.getCourseTags().forEach(link -> v.tags.add(new CourseVersionTag(v, link.getTag())));
        for (CourseChapter chapter : c.activeChapters()) {
            var vc = new CourseVersionChapter(v, chapter);
            v.chapters.add(vc);
            for (Lesson lesson : chapter.activeLessons()) v.lessons.add(new CourseVersionLesson(v, vc, lesson));
        }
        return v;
    }
}
