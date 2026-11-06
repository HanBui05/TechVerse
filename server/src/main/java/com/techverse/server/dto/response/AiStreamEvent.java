package com.techverse.server.dto.response;

import java.util.UUID;

/** SSE payloads; each is serialized by Jackson into one {@code data:} line. */
public sealed interface AiStreamEvent {
    String name();

    record Metadata(UUID generationId, long timeoutSeconds) implements AiStreamEvent {
        public String name() {
            return "metadata";
        }
    }

    record Delta(String text) implements AiStreamEvent {
        public String name() {
            return "delta";
        }
    }

    record Completed(
            UUID generationId,
            boolean validated,
            long contentBytes,
            String contentSha256,
            Integer quotaRemaining)
            implements AiStreamEvent {
        public String name() {
            return "completed";
        }
    }

    record Cancelled(UUID generationId, String reason, Integer quotaRemaining) implements AiStreamEvent {
        public String name() {
            return "cancelled";
        }
    }

    record Error(UUID generationId, String code, String message, boolean retryable, Integer quotaRemaining)
            implements AiStreamEvent {
        public String name() {
            return "error";
        }
    }
}
