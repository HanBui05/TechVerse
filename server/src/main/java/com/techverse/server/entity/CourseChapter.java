package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.*;

/** Working-copy chapter. Archived (never deleted) once an approved snapshot referenced it. */
@Entity
@Table(name = "course_chapters")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseChapter extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false, updatable = false)
    private Course course;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false)
    private int position;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @OneToMany(mappedBy = "chapter", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<Lesson> lessons = new ArrayList<>();

    CourseChapter(Course course, String title, int position) {
        this.course = course;
        this.title = title;
        this.position = position;
    }

    public boolean isActive() {
        return archivedAt == null;
    }

    public List<Lesson> activeLessons() {
        return lessons.stream()
                .filter(Lesson::isActive)
                .sorted(Comparator.comparingInt(Lesson::getPosition))
                .toList();
    }

    void archive(Instant at) {
        archivedAt = at;
        lessons.forEach(l -> l.archive(at));
    }
}
