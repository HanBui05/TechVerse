package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;

/** A learner's "reviewed" / "saved" stamps on one question; both NULL means unmarked. */
@Entity
@Table(name = "interview_question_marks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewQuestionMark extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private InterviewQuestion question;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "saved_at")
    private Instant savedAt;
}
