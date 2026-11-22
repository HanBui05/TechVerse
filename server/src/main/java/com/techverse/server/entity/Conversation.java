package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * One private conversation per (learner, author) pair. Rows are created by the repository's upsert;
 * every change below happens under the row lock ({@code findByIdForUpdate}).
 */
@Entity
@Table(name = "conversations")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Conversation extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "learner_id", nullable = false, updatable = false)
    private User learner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    private User author;

    /** Null once the course is deleted; the stored title stays. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "context_course_id")
    private Course contextCourse;

    @Column(name = "context_course_title", nullable = false, length = 255)
    private String contextCourseTitle;

    @Column(name = "author_replied", nullable = false)
    private boolean authorReplied;

    @Column(name = "last_message_seq")
    private Long lastMessageSeq;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    @Column(name = "last_message_sender_id")
    private UUID lastMessageSenderId;

    @Column(name = "learner_last_read_seq", nullable = false)
    private long learnerLastReadSeq;

    @Column(name = "author_last_read_seq", nullable = false)
    private long authorLastReadSeq;

    @Column(name = "blocked_by")
    private UUID blockedBy;

    @Column(name = "blocked_at")
    private Instant blockedAt;

    @Column(name = "locked_by")
    private UUID lockedBy;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "lock_note", columnDefinition = "text")
    private String lockNote;

    public boolean isParticipant(UUID user) {
        return isLearner(user) || author.getId().equals(user);
    }

    public boolean isLearner(UUID user) {
        return learner.getId().equals(user);
    }

    public boolean isBlocked() {
        return blockedBy != null;
    }

    /** Locked state is the timestamp: the moderator reference may be cleared when that account is deleted. */
    public boolean isLocked() {
        return lockedAt != null;
    }

    public long lastReadSeq(UUID user) {
        return isLearner(user) ? learnerLastReadSeq : authorLastReadSeq;
    }

    public void recordMessage(Message m) {
        lastMessageSeq = m.getSeq();
        lastMessageAt = m.getCreatedAt();
        lastMessageSenderId = m.getSenderId();
        if (!isLearner(m.getSenderId())) authorReplied = true;
    }

    public void markRead(UUID user, long seq) {
        if (isLearner(user)) learnerLastReadSeq = seq;
        else authorLastReadSeq = seq;
    }
}
