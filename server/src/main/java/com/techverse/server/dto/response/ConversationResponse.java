package com.techverse.server.dto.response;

import java.time.Instant;
import java.util.*;

/** Messaging views for the two participants only; excerpts and contents never leave this API. */
public final class ConversationResponse {
    private ConversationResponse() {}

    /** {@code id} is null once the course is deleted; {@code available} is whether it is public now. */
    public record ContextCourse(UUID id, String title, boolean available) {}

    public record Summary(
            UUID id,
            ArticleAuthorResponse other,
            String role,
            ContextCourse contextCourse,
            Boolean contextEnrolled,
            String lastMessageExcerpt,
            Instant lastMessageAt,
            boolean unread,
            boolean blockedByMe,
            boolean blockedByOther,
            boolean locked) {}

    /** A summary plus what the caller may do; {@code remainingBeforeReply} is null for the author or once the author replied. */
    public record Detail(
            UUID id,
            ArticleAuthorResponse other,
            String role,
            ContextCourse contextCourse,
            Boolean contextEnrolled,
            String lastMessageExcerpt,
            Instant lastMessageAt,
            boolean unread,
            boolean blockedByMe,
            boolean blockedByOther,
            boolean locked,
            boolean canSend,
            Integer remainingBeforeReply) {
        public static Detail of(Summary s, boolean canSend, Integer remainingBeforeReply) {
            return new Detail(s.id(), s.other(), s.role(), s.contextCourse(), s.contextEnrolled(), s.lastMessageExcerpt(), s.lastMessageAt(),
                    s.unread(), s.blockedByMe(), s.blockedByOther(), s.locked(), canSend, remainingBeforeReply);
        }
    }

    public record Message(UUID id, long seq, UUID senderId, boolean mine, String content, Instant createdAt) {}

    /** Always in ascending seq. */
    public record Messages(List<Message> messages, boolean hasMore) {}

    public record UnreadCount(long count) {}
}
