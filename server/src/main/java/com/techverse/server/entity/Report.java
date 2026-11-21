package com.techverse.server.entity;

import com.techverse.server.enums.ReportReason;
import com.techverse.server.enums.ReportStatus;

import jakarta.persistence.*;

import lombok.*;

import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;
import java.util.UUID;

/** A user's report on a piece of content. {@code targetId} has no foreign key: the service checks the target first. */
@Entity
@Table(name = "reports")
@DynamicUpdate
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Report extends BaseEntity {
    public static final String FORUM_POST = "FORUM_POST";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @Column(name = "target_type", nullable = false, length = 20)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportReason reason;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportStatus status = ReportStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "handled_by")
    private User handledBy;

    @Column(name = "handled_at")
    private Instant handledAt;

    @Column(name = "resolution_note", columnDefinition = "text")
    private String resolutionNote;

    public static Report forumPost(User reporter, UUID postId, ReportReason reason, String description) {
        var r = new Report();
        r.reporter = reporter;
        r.targetType = FORUM_POST;
        r.targetId = postId;
        r.reason = reason;
        r.description = description;
        return r;
    }

    public void close(ReportStatus outcome, User moderator, String note) {
        status = outcome;
        handledBy = moderator;
        handledAt = Instant.now();
        resolutionNote = note;
    }
}
