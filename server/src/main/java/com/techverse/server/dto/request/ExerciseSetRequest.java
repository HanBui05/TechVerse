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

    /** AI suggestions: optional hints, how many to propose, and the set version the client holds. */
    public record AiQuestions(
            @NotNull @Min(0) Integer version,
            @Size(max = 500) String instruction,
            @Size(max = 8000) String sourceText,
            @NotNull @Min(1) @Max(10) Integer count) {}

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

    /** Moderator decisions; note/reason requirements depend on the decision, so the service checks them. */
    public record Review(
            @NotNull ArticleReviewDecision decision,
            @NotNull @Pattern(regexp = "[a-f0-9]{64}") String reviewToken,
            @Size(max = 1000) String note) {}

    public record Publication(
            @NotNull ArticlePublicationAction action,
            @NotNull @Pattern(regexp = "[a-f0-9]{64}") String reviewToken,
            @Size(max = 1000) String reason) {}

    /** Quiz sends {@code answers}, flashcards send {@code results}; the grader rejects the wrong shape. */
    public record Attempt(List<Answer> answers, List<Remembered> results, Integer durationSeconds) {
        public record Answer(UUID questionId, Integer selectedIndex) {}

        public record Remembered(UUID questionId, Boolean remembered) {}
    }

    @Getter
    @Setter
    public static class ModeratorFilter extends Filter {
        private UUID topicId;
    }

    @Getter
    @Setter
    public static class PublicFilter {
        private UUID topicId;
        private ExerciseDifficulty difficulty;
        private ExerciseType type;

        @Size(max = 100)
        private String keyword;

        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;
    }

    @Getter
    @Setter
    public static class AttemptFilter {
        private UUID exerciseSetId;

        @Min(0)
        private int page = 0;

        @Min(1)
        @Max(50)
        private int size = 20;
    }

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
