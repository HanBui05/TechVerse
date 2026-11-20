package com.techverse.server.dto.response;

import com.techverse.server.entity.*;
import com.techverse.server.enums.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExerciseSetResponse(
        UUID id,
        String title,
        String description,
        ArticleOptionResponse topic,
        ExerciseType type,
        ExerciseDifficulty difficulty,
        ExerciseStatus status,
        boolean aiAssisted,
        int version,
        String moderationNote,
        long questionCount,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt,
        List<Question> questions) {

    /** Author view: includes answers. Null fields are the ones that do not apply to the set type. */
    public record Question(
            UUID id,
            int position,
            String content,
            String codeSnippet,
            String codeLanguage,
            List<String> options,
            Integer correctIndex,
            String explanation,
            String front,
            String back) {
        static Question of(ExerciseSet set, ExerciseQuestion q) {
            boolean card = set.getType() == ExerciseType.FLASHCARD;
            return card
                    ? new Question(q.getId(), q.getPosition(), null, null, null, null, null, q.getExplanation(), q.getContent(), q.getAnswer())
                    : new Question(q.getId(), q.getPosition(), q.getContent(), q.getCodeSnippet(), q.getCodeLanguage(), q.getOptions(),
                            Integer.valueOf(q.getAnswer()), q.getExplanation(), null, null);
        }
    }

    /** {@code questions == null} for list rows. */
    public static ExerciseSetResponse of(ExerciseSet s, long count, List<ExerciseQuestion> questions) {
        var t = s.getTopic();
        return new ExerciseSetResponse(
                s.getId(), s.getTitle(), s.getDescription(), new ArticleOptionResponse(t.getId(), t.getName(), t.isActive()),
                s.getType(), s.getDifficulty(), s.getStatus(), s.isAiAssisted(), s.getVersion(), s.getModerationNote(),
                count, s.getPublishedAt(), s.getCreatedAt(), s.getUpdatedAt(),
                questions == null ? null : questions.stream().map(q -> Question.of(s, q)).toList());
    }
}
