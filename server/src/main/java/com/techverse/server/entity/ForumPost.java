package com.techverse.server.entity;

import static com.techverse.server.enums.ForumPostStatus.*;

import com.techverse.server.enums.ForumPostStatus;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;
import java.util.Objects;

/**
 * A forum question (no parent, has title and topic) or a one-level answer (parent = question).
 * {@code acceptedAnswer} is mapped one way only; responses are built from DTOs, never serialized directly.
 */
@Entity
@Table(name = "forum_posts")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ForumPost extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private ForumPost parent;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id")
    private Topic topic;

    @Column(length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ForumPostStatus status = VISIBLE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accepted_answer_id")
    private ForumPost acceptedAnswer;

    @Column(name = "edited_at")
    private Instant editedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hidden_by")
    private User hiddenBy;

    @Column(name = "hidden_at")
    private Instant hiddenAt;

    @Column(name = "moderation_note", columnDefinition = "text")
    private String moderationNote;

    public static ForumPost question(User user, Topic topic, String title, String content) {
        var p = new ForumPost();
        p.user = user;
        p.topic = topic;
        p.title = title;
        p.content = content;
        return p;
    }

    public static ForumPost answer(User user, ForumPost question, String content) {
        var p = new ForumPost();
        p.user = user;
        p.parent = question;
        p.content = content;
        return p;
    }

    public boolean isQuestion() {
        return parent == null;
    }

    public boolean isOwnedBy(java.util.UUID actor) {
        return actor != null && actor.equals(user.getId());
    }

    /** Null arguments keep the current value; the edit stamp moves only when something changed. */
    public void edit(Topic newTopic, String newTitle, String newContent) {
        boolean changed = false;
        if (newTopic != null && !newTopic.getId().equals(topic.getId())) {
            topic = newTopic;
            changed = true;
        }
        if (newTitle != null && !newTitle.equals(title)) {
            title = newTitle;
            changed = true;
        }
        if (newContent != null && !newContent.equals(content)) {
            content = newContent;
            changed = true;
        }
        if (changed) editedAt = Instant.now();
    }

    public void delete() {
        status = DELETED;
    }

    /** {@code null} clears the choice. */
    public void accept(ForumPost answer) {
        acceptedAnswer = answer;
    }

    public boolean isAccepted(ForumPost answer) {
        return acceptedAnswer != null && Objects.equals(acceptedAnswer.getId(), answer.getId());
    }
}
