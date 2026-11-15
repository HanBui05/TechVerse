package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Course access row; this module only creates FREE rows (native insert, idempotent on the active
 * unique index) and never revokes them. Payment columns stay unmapped.
 */
@Entity
@Table(name = "course_enrollments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseEnrollment extends BaseEntity {
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false, updatable = false)
    private Course course;

    @Column(nullable = false, length = 20, updatable = false)
    private String source;

    @Column(name = "granted_at", nullable = false, updatable = false)
    private Instant grantedAt;

    @Column(name = "revoked_at", updatable = false)
    private Instant revokedAt;

    @Column(name = "last_lesson_id")
    private UUID lastLessonId;

    @Column(name = "last_accessed_at")
    private Instant lastAccessedAt;
}
