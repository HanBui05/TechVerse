package com.techverse.server.entity;

import static com.techverse.server.enums.InterviewStatus.*;

import com.techverse.server.enums.*;
import com.techverse.server.exception.*;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;

/**
 * One interview question with its sample answer. Same status axis as exercise sets (see the module
 * spec); {@code version} is bumped by every change and doubles as the optimistic-lock token.
 */
@Entity
@Table(name = "interview_questions")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InterviewQuestion extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "topic_id", nullable = false)
    private Topic topic;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InterviewLevel level;

    @Column(nullable = false, columnDefinition = "text")
    private String question;

    @Column(name = "sample_answer", nullable = false, columnDefinition = "text")
    private String sampleAnswer;

    @Column(columnDefinition = "text")
    private String hint;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private InterviewStatus status = DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "hidden_from_status", length = 30)
    private InterviewStatus hiddenFromStatus;

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

    public static InterviewQuestion create(
            User author, Topic topic, InterviewLevel level, String question, String sampleAnswer, String hint) {
        var q = new InterviewQuestion();
        q.author = author;
        q.topic = topic;
        q.level = level;
        q.question = question;
        q.sampleAnswer = sampleAnswer;
        q.hint = blankToNull(hint);
        return q;
    }

    /** A new DRAFT with the same content and AI flag; marks stay with the original. */
    public InterviewQuestion copy() {
        var c = create(author, topic, level, question, sampleAnswer, hint);
        c.aiAssisted = aiAssisted;
        return c;
    }

    // ------------------------------------------------------------------ content

    public void ensureEditable() {
        if (status != DRAFT && status != CHANGES_REQUESTED) throw new CustomException(ErrorCode.INTERVIEW_NOT_EDITABLE);
    }

    public void ensureDeletable() {
        if (publishedAt != null || (status != DRAFT && status != CHANGES_REQUESTED))
            throw new CustomException(ErrorCode.INTERVIEW_NOT_DELETABLE);
    }

    public void ensureVersion(int expected) {
        if (version != expected) throw new CustomException(ErrorCode.INTERVIEW_VERSION_CONFLICT);
    }

    /** Null keeps a field; a blank hint clears it. */
    public void edit(Topic topic, InterviewLevel level, String question, String sampleAnswer, String hint) {
        ensureEditable();
        if (topic != null) this.topic = topic;
        if (level != null) this.level = level;
        if (question != null) this.question = question;
        if (sampleAnswer != null) this.sampleAnswer = sampleAnswer;
        if (hint != null) this.hint = blankToNull(hint);
        version++;
    }

    // ------------------------------------------------------------------ author transitions

    public void submit() {
        from(DRAFT, CHANGES_REQUESTED);
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

    private void review(User reviewer, String note, InterviewStatus to) {
        moderationNote = note;
        reviewedBy = reviewer;
        reviewedAt = Instant.now();
        moveTo(to);
    }

    private void from(InterviewStatus... allowed) {
        for (var s : allowed) if (s == status) return;
        throw new CustomException(ErrorCode.INTERVIEW_STATE_INVALID);
    }

    private void moveTo(InterviewStatus to) {
        status = to;
        version++;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
