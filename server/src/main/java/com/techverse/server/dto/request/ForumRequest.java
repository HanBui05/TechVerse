package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.validation.constraints.*;

import lombok.*;

import java.util.UUID;

/** Forum bodies and the list filter. Lengths count after trim; Markdown rules are checked by the service. */
public final class ForumRequest {
    private ForumRequest() {}

    // A malformed UUID in a JSON body would otherwise surface as MALFORMED_REQUEST, not a field error.
    static final String UUID_PATTERN = InterviewQuestionRequest.UUID_PATTERN;

    public record CreateQuestion(
            @NotNull @Size(min = 10, max = 150) String title,
            @NotNull @Size(min = 20, max = 10000) String content,
            @NotNull @Pattern(regexp = UUID_PATTERN) String topicId) {
        public CreateQuestion {
            title = strip(title);
            content = strip(content);
        }
    }

    /** Omitted fields are kept; a field sent as {@code null} is refused. */
    @Getter
    public static class UpdateQuestion {
        @Size(min = 10, max = 150)
        private String title;

        @Size(min = 20, max = 10000)
        private String content;

        @Pattern(regexp = UUID_PATTERN)
        private String topicId;

        @JsonIgnore
        private boolean sentNull;

        public void setTitle(String v) {
            sentNull |= v == null;
            title = strip(v);
        }

        public void setContent(String v) {
            sentNull |= v == null;
            content = strip(v);
        }

        public void setTopicId(String v) {
            sentNull |= v == null;
            topicId = v;
        }

        @JsonIgnore
        @AssertFalse(message = "Fields cannot be null")
        public boolean isSentNull() {
            return sentNull;
        }
    }

    public record Answer(@NotNull @Size(min = 10, max = 10000) String content) {
        public Answer {
            content = strip(content);
        }
    }

    /** {@code answerId} must be present: a UUID to choose, an explicit {@code null} to clear. */
    @Getter
    public static class Accept {
        @Pattern(regexp = UUID_PATTERN)
        private String answerId;

        @JsonIgnore
        private boolean present;

        public void setAnswerId(String v) {
            present = true;
            answerId = v;
        }

        @JsonIgnore
        @AssertTrue(message = "answerId is required (null clears the choice)")
        public boolean isPresent() {
            return present;
        }
    }

    @Getter
    @Setter
    public static class Filter {
        private UUID topicId;
        private Boolean solved;
        private boolean mine;
        private String keyword;

        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;

        /** Blank means no keyword filter; otherwise 2–100 characters after trim. */
        @AssertTrue(message = "keyword must be 2-100 characters")
        public boolean isKeywordValid() {
            if (keyword == null || keyword.isBlank()) return true;
            int n = keyword.strip().length();
            return n >= 2 && n <= 100;
        }
    }

    private static String strip(String s) {
        return s == null ? null : s.strip();
    }
}
