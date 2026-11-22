package com.techverse.server.dto.request;

import jakarta.validation.constraints.*;

import lombok.*;

import java.util.UUID;

/** Messaging bodies and filters. Content length counts after trim; Markdown rules are checked by the service. */
public final class ConversationRequest {
    private ConversationRequest() {}

    public record Open(@NotNull @Pattern(regexp = ForumRequest.UUID_PATTERN) String courseId) {
        public UUID course() {
            return UUID.fromString(courseId);
        }
    }

    public record Send(@NotNull @Size(min = 1, max = 2000) String content, @NotNull @Pattern(regexp = ForumRequest.UUID_PATTERN) String clientId) {
        public Send {
            content = content == null ? null : content.strip();
        }

        public UUID client() {
            return UUID.fromString(clientId);
        }
    }

    public record Read(@NotNull @Min(0) Long seq) {}

    @Getter
    @Setter
    public static class Page {
        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;
    }

    /** No cursor: the latest messages; {@code beforeSeq}: older ones; {@code afterSeq}: the earliest newer ones. */
    @Getter
    @Setter
    public static class Messages {
        @Min(0)
        private Long beforeSeq;

        @Min(0)
        private Long afterSeq;

        @Min(1)
        @Max(50)
        private int size = 30;

        @AssertTrue(message = "Send beforeSeq or afterSeq, not both")
        public boolean isOneCursor() {
            return beforeSeq == null || afterSeq == null;
        }
    }
}
