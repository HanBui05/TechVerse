package com.techverse.server.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import com.techverse.server.enums.*;

import lombok.*;

import java.util.List;
import java.util.UUID;

/** Author write bodies for exercise sets. Question contents are validated by the service (field-level codes). */
public final class ExerciseSetRequest {
    private ExerciseSetRequest() {}

    public record Create(
            @NotNull @Size(min = 5, max = 255) String title,
            @Size(max = 2000) String description,
            @NotNull UUID topicId,
            @NotNull @Pattern(regexp = "MULTIPLE_CHOICE|FLASHCARD") String type,
            @NotNull @Pattern(regexp = "EASY|MEDIUM|HARD") String difficulty) {
        public Create {
            title = title == null ? null : title.strip();
        }
    }

    /** Omitted fields are kept; {@code type} must stay absent (it never changes). */
    public record Update(
            @NotNull @Min(0) Integer version,
            @Size(min = 5, max = 255) String title,
            @Size(max = 2000) String description,
            UUID topicId,
            @Pattern(regexp = "EASY|MEDIUM|HARD") String difficulty,
            @Null String type) {
        public Update {
            title = title == null ? null : title.strip();
        }
    }

    public record Questions(@NotNull @Min(0) Integer version, @NotNull @Valid List<Question> questions) {}

    /** Quiz uses content/options/correctIndex/explanation; card uses front/back/explanation. */
    public record Question(
            String content,
            String codeSnippet,
            String codeLanguage,
            List<String> options,
            Integer correctIndex,
            String explanation,
            String front,
            String back) {}

    @Getter
    @Setter
    public static class Filter {
        private ExerciseStatus status;
        private ExerciseType type;

        @Size(max = 100)
        private String keyword;

        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;
    }
}
