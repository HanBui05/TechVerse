package com.techverse.server.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** A learner's question about one lesson plus up to six earlier turns; nothing is stored. */
public record LessonTutorRequest(
        @NotNull @Size(min = 1, max = 500) String question,
        @Size(max = 6) List<@NotNull @Valid Turn> history) {

    /** Role stays text so an unknown value is a field VALIDATION_ERROR, not an unreadable body. */
    public record Turn(@NotNull @Pattern(regexp = "USER|ASSISTANT") String role, @NotNull @Size(min = 1, max = 2000) String content) {
        public Turn {
            content = content == null ? null : content.strip();
        }
    }

    public LessonTutorRequest {
        question = question == null ? null : question.strip();
        history = history == null ? List.of() : history;
    }
}
