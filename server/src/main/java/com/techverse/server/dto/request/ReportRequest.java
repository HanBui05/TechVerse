package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.techverse.server.enums.ReportReason;
import com.techverse.server.enums.ReportStatus;

import jakarta.validation.constraints.*;

import lombok.*;

/**
 * Report bodies and moderation filters. Enum-like body fields are strings with a pattern so a wrong value is a
 * field error (VALIDATION_ERROR), not an unreadable body. Text is stripped; blank optional text becomes null.
 */
public final class ReportRequest {
    private ReportRequest() {}

    public record Create(
            @NotNull @Pattern(regexp = "FORUM_POST") String targetType,
            @NotNull @Pattern(regexp = ForumRequest.UUID_PATTERN) String targetId,
            @NotNull(message = "Hãy chọn lý do.") @Pattern(regexp = "SPAM|INAPPROPRIATE|COPYRIGHT|MISLEADING|OTHER", message = "Hãy chọn lý do.")
                    String reason,
            @Size(max = 1000, message = "Hãy mô tả vi phạm (10–1.000 ký tự).") String description) {
        public Create {
            description = blankToNull(description);
        }

        @JsonIgnore
        @AssertTrue(message = "Hãy mô tả vi phạm (10–1.000 ký tự).")
        public boolean isDescriptionValid() {
            if (description != null && description.indexOf(0) >= 0) return false;
            return !"OTHER".equals(reason) || (description != null && description.length() >= 10);
        }

        public ReportReason reasonValue() {
            return ReportReason.valueOf(reason);
        }
    }

    /** {@code note} is required for HIDE_CONTENT, optional for DISMISS. */
    public record Resolve(
            @NotNull @Pattern(regexp = "HIDE_CONTENT|DISMISS") String action,
            @Size(max = 1000, message = "Hãy ghi lý do (tối đa 1.000 ký tự).") String note) {
        public Resolve {
            note = blankToNull(note);
        }

        @JsonIgnore
        @AssertTrue(message = "Hãy ghi lý do (tối đa 1.000 ký tự).")
        public boolean isNoteValid() {
            return noteValid("HIDE_CONTENT".equals(action), note);
        }

        public boolean hide() {
            return "HIDE_CONTENT".equals(action);
        }
    }

    /** {@code note} is required for HIDE, optional for RESTORE. */
    public record Visibility(
            @NotNull @Pattern(regexp = "HIDE|RESTORE") String action,
            @Size(max = 1000, message = "Hãy ghi lý do (tối đa 1.000 ký tự).") String note) {
        public Visibility {
            note = blankToNull(note);
        }

        @JsonIgnore
        @AssertTrue(message = "Hãy ghi lý do (tối đa 1.000 ký tự).")
        public boolean isNoteValid() {
            return noteValid("HIDE".equals(action), note);
        }

        public boolean hide() {
            return "HIDE".equals(action);
        }
    }

    @Getter
    @Setter
    public static class Queue {
        // `?status=` binds null over the default; refuse it instead of listing nothing.
        @NotNull
        private ReportStatus status = ReportStatus.OPEN;
        private ReportReason reason;

        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;
    }

    @Getter
    @Setter
    public static class Hidden {
        @Pattern(regexp = "HIDDEN")
        private String status = "HIDDEN";

        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;
    }

    /** PostgreSQL text cannot hold NUL. */
    public static boolean noteValid(boolean required, String note) {
        if (note != null && note.indexOf(0) >= 0) return false;
        return !required || note != null;
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.strip();
        return t.isEmpty() ? null : t;
    }
}
