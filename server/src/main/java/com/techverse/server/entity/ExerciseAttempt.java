package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** One finished attempt. {@code snapshot} holds everything needed to review it after the set is hidden or removed. */
@Entity
@Table(name = "exercise_attempts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExerciseAttempt extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_set_id", nullable = false)
    private ExerciseSet exerciseSet;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attempt_snapshot", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> snapshot;

    @Column(name = "correct_count")
    private Integer correctCount;

    @Column(name = "total_count")
    private Integer totalCount;

    @Column(name = "duration_seconds", nullable = false)
    private int durationSeconds;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "idempotency_key", nullable = false, updatable = false)
    private UUID idempotencyKey;

    public static ExerciseAttempt of(
            User user, ExerciseSet set, UUID key, Map<String, Object> snapshot, int correct, int total, int duration) {
        var a = new ExerciseAttempt();
        a.user = user;
        a.exerciseSet = set;
        a.idempotencyKey = key;
        a.snapshot = snapshot;
        a.correctCount = correct;
        a.totalCount = total;
        a.durationSeconds = duration;
        a.completedAt = Instant.now();
        return a;
    }
}
