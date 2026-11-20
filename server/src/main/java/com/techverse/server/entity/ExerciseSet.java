package com.techverse.server.entity;

import static com.techverse.server.enums.ExerciseStatus.*;

import com.techverse.server.enums.*;
import com.techverse.server.exception.*;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;

/**
 * A quiz or flashcard set. One status axis (see the module spec); {@code version} is bumped by every
 * change, including child-question replacement, and doubles as the optimistic-lock and review token.
 */
@Entity
@Table(name = "exercise_sets")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExerciseSet extends BaseEntity {
    public static final int MIN_QUESTIONS = 3;
    public static final int MIN_CARDS = 5;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false)
    private Topic topic;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "exercise_type", nullable = false, length = 30)
    private ExerciseType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExerciseDifficulty difficulty;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ExerciseStatus status = DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "hidden_from_status", length = 30)
    private ExerciseStatus hiddenFromStatus;

    @Column(name = "ai_assisted", nullable = false)
    private boolean aiAssisted;

    @Column(nullable = false)
    private int version;

    @Column(name = "moderation_note", columnDefinition = "text")
    private String moderationNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    public static ExerciseSet create(
            User author, Topic topic, String title, String description, ExerciseType type, ExerciseDifficulty difficulty) {
        var set = new ExerciseSet();
        set.author = author;
        set.topic = topic;
        set.title = title;
        set.description = description;
        set.type = type;
        set.difficulty = difficulty;
        return set;
    }

    public static int minQuestions(ExerciseType type) {
        return type == ExerciseType.FLASHCARD ? MIN_CARDS : MIN_QUESTIONS;
    }

    // ------------------------------------------------------------------ content

    public void ensureEditable() {
        if (status != DRAFT && status != CHANGES_REQUESTED) throw new CustomException(ErrorCode.EXERCISE_NOT_EDITABLE);
    }

    public void ensureDeletable() {
        if (publishedAt != null || (status != DRAFT && status != CHANGES_REQUESTED))
            throw new CustomException(ErrorCode.EXERCISE_NOT_DELETABLE);
    }

    public void ensureVersion(int expected) {
        if (version != expected) throw new CustomException(ErrorCode.EXERCISE_VERSION_CONFLICT);
    }

    public void bump() {
        version++;
    }

    public void edit(String title, String description, Topic topic, ExerciseDifficulty difficulty) {
        ensureEditable();
        if (title != null) this.title = title;
        if (description != null) this.description = description;
        if (topic != null) this.topic = topic;
        if (difficulty != null) this.difficulty = difficulty;
        bump();
    }

    public void markAiAssisted() {
        aiAssisted = true;
        bump();
    }

    // ------------------------------------------------------------------ author transitions

    public void submit(long questionCount) {
        from(DRAFT, CHANGES_REQUESTED);
        if (questionCount < minQuestions(type)) throw new CustomException(ErrorCode.EXERCISE_NOT_READY);
        moveTo(PENDING);
    }

    public void withdraw() {
        from(PENDING);
        moveTo(DRAFT);
    }

    public void authorHide() {
        from(PUBLISHED);
        moveTo(AUTHOR_HIDDEN);
    }

    public void authorUnhide() {
        from(AUTHOR_HIDDEN);
        moveTo(PUBLISHED);
    }

    // ------------------------------------------------------------------ moderator transitions

    public void approve(User reviewer, String note) {
        from(PENDING);
        if (publishedAt == null) publishedAt = Instant.now();
        review(reviewer, note, PUBLISHED);
    }

    public void requestChanges(User reviewer, String note) {
        from(PENDING);
        review(reviewer, note, CHANGES_REQUESTED);
    }

    public void moderatorHide(User reviewer, String note) {
        from(PUBLISHED, AUTHOR_HIDDEN);
        hiddenFromStatus = status;
        review(reviewer, note, HIDDEN);
    }

    public void moderatorRestore(User reviewer, String note) {
        from(HIDDEN);
        var back = hiddenFromStatus;
        hiddenFromStatus = null;
        review(reviewer, note, back);
    }

    public void remove(User reviewer, String note) {
        from(PUBLISHED, AUTHOR_HIDDEN, HIDDEN);
        hiddenFromStatus = null;
        review(reviewer, note, REMOVED);
    }

    private void review(User reviewer, String note, ExerciseStatus to) {
        moderationNote = note;
        reviewedBy = reviewer;
        reviewedAt = Instant.now();
        moveTo(to);
    }

    private void from(ExerciseStatus... allowed) {
        for (var s : allowed) if (s == status) return;
        throw new CustomException(ErrorCode.EXERCISE_STATE_INVALID);
    }

    private void moveTo(ExerciseStatus to) {
        status = to;
        bump();
    }
}
