package com.techverse.server.entity;

import com.techverse.server.enums.ForumReactionType;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** One user's reaction on one forum post. Read-only here: rows are written by the repository's upsert and delete. */
@Entity
@Table(name = "forum_post_reactions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ForumPostReaction {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private ForumPost post;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ForumReactionType type;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** When the current type was chosen. */
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
