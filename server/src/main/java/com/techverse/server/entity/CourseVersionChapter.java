package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "course_publication_version_chapters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseVersionChapter extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "version_id", nullable = false, updatable = false)
    private CoursePublicationVersion version;

    /** Stable working-copy ID; the snapshot keeps its own title and position. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chapter_id", nullable = false, updatable = false)
    private CourseChapter chapter;

    @Column(nullable = false, length = 255, updatable = false)
    private String title;

    @Column(nullable = false, updatable = false)
    private int position;

    CourseVersionChapter(CoursePublicationVersion version, CourseChapter chapter) {
        this.version = version;
        this.chapter = chapter;
        this.title = chapter.getTitle();
        this.position = chapter.getPosition();
    }
}
