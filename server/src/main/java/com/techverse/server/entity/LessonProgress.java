package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** One completed lesson of a learner (stable lesson ID, so it survives new versions). */
@Entity
@Table(name = "lesson_progress")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LessonProgress extends BaseEntity {
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "lesson_id", nullable = false, updatable = false)
    private UUID lessonId;

    @Column(name = "completed_at", nullable = false, updatable = false)
    private Instant completedAt;
}
