package com.techverse.server.dto.request;

import com.techverse.server.enums.*;

import jakarta.validation.constraints.*;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/** Author bodies and filters for interview questions. Markdown rules are checked by the service. */
public final class InterviewQuestionRequest {
    private InterviewQuestionRequest() {}

    // A malformed UUID in a JSON body would otherwise surface as MALFORMED_REQUEST, not a field error.
    static final String UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

    public record Create(
            @NotNull @Pattern(regexp = UUID_PATTERN) String topicId,
            @NotNull @Pattern(regexp = "EASY|MEDIUM|HARD") String level,
            @NotNull @Size(min = 10, max = 1000) String question,
            @NotNull @Size(min = 20, max = 5000) String sampleAnswer,
            @Size(max = 500) String hint) {
        public Create {
            question = strip(question);
            sampleAnswer = strip(sampleAnswer);
            hint = strip(hint);
        }
    }

    /** Omitted fields are kept; an empty {@code hint} clears it. {@code version} is a decimal so 0.9 is refused, not truncated to 0. */
    public record Update(
            @NotNull @Digits(integer = 10, fraction = 0) @Min(0) @Max(Integer.MAX_VALUE) BigDecimal version,
            @Pattern(regexp = UUID_PATTERN) String topicId,
            @Pattern(regexp = "EASY|MEDIUM|HARD") String level,
            @Size(min = 10, max = 1000) String question,
            @Size(min = 20, max = 5000) String sampleAnswer,
            @Size(max = 500) String hint) {
        public Update {
            question = strip(question);
            sampleAnswer = strip(sampleAnswer);
            hint = strip(hint);
        }
    }

    public record Visibility(@NotNull @Pattern(regexp = "HIDE|UNHIDE") String action) {}

    @Getter
    @Setter
    public static class Filter {
        private InterviewStatus status;
        private InterviewLevel level;
        private UUID topicId;

        @Size(max = 100)
        private String keyword;

        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;
    }

    private static String strip(String s) {
        return s == null ? null : s.strip();
    }
}
