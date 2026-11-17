package com.techverse.server.dto.response;

import com.techverse.server.entity.*;
import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Learner-facing and moderator-facing views of exercise sets; none of these carries a quiz answer before submission. */
public final class ExercisePracticeResponse {
    private ExercisePracticeResponse() {}

    /** {@code viewer} is null in list rows; {@code lastAttempt} is null for guests and first-timers. */
    public record PracticeSet(
            UUID id,
            String title,
            String description,
            ArticleOptionResponse topic,
            ExerciseType type,
            ExerciseDifficulty difficulty,
            long questionCount,
            ArticleAuthorResponse author,
            Instant publishedAt,
            Attempt lastAttempt,
            Viewer viewer) {}

    /** {@code reason}: LOGIN_REQUIRED, OWNER or STAFF when {@code canAttempt} is false. */
    public record Viewer(boolean canAttempt, String reason) {}

    /** Quiz question for a learner: deliberately no answer, index or explanation. */
    public record QuizQuestion(
            UUID id, int position, String content, String codeSnippet, String codeLanguage, List<String> options) {}

    public record CardQuestion(UUID id, int position, String front, String back, String explanation) {}

    /** {@code questions} holds {@link QuizQuestion}s or {@link CardQuestion}s according to {@code type}. */
    public record Questions(UUID setId, ExerciseType type, List<?> questions) {}

    /** {@code items} (from the stored snapshot) is null in list rows. */
    public record Attempt(
            UUID id,
            UUID exerciseSetId,
            String title,
            ExerciseType type,
            int correctCount,
            int totalCount,
            int percent,
            int durationSeconds,
            Instant completedAt,
            Object items) {
        public static Attempt of(ExerciseAttempt a, boolean withItems) {
            var snap = a.getSnapshot();
            int correct = a.getCorrectCount() == null ? 0 : a.getCorrectCount();
            int total = a.getTotalCount() == null ? 0 : a.getTotalCount();
            return new Attempt(
                    a.getId(), a.getExerciseSet().getId(), (String) snap.get("title"), ExerciseType.valueOf((String) snap.get("type")),
                    correct, total, total == 0 ? 0 : correct * 100 / total, a.getDurationSeconds(), a.getCompletedAt(),
                    withItems ? snap.get("items") : null);
        }
    }

    /** Moderator queue row or detail ({@code set.questions} only on detail). */
    public record Moderated(ExerciseSetResponse set, ArticleAuthorResponse author, boolean authorEligible, String reviewToken) {}
}
