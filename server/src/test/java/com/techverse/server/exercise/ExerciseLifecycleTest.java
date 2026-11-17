package com.techverse.server.exercise;

import static com.techverse.server.enums.ExerciseStatus.*;
import static org.assertj.core.api.Assertions.*;

import com.techverse.server.dto.request.ExerciseSetRequest.Question;
import com.techverse.server.entity.ExerciseSet;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.AuthorExerciseService;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;
import java.util.function.Consumer;
import java.util.stream.IntStream;

/** Pure logic: set state machine and question validation (no Spring). */
class ExerciseLifecycleTest {
    static ExerciseSet set(ExerciseType type, ExerciseStatus status) {
        var set = ExerciseSet.create(null, null, "Title", "", type, ExerciseDifficulty.EASY);
        ReflectionTestUtils.setField(set, "status", status);
        if (status == PUBLISHED || status == AUTHOR_HIDDEN || status == HIDDEN || status == REMOVED)
            ReflectionTestUtils.setField(set, "publishedAt", java.time.Instant.now());
        if (status == HIDDEN) ReflectionTestUtils.setField(set, "hiddenFromStatus", PUBLISHED);
        return set;
    }

    static void assertCode(Runnable action, ErrorCode code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }

    /** Every status on which {@code action} works; all others must fail with STATE_INVALID. */
    static void only(Consumer<ExerciseSet> action, ExerciseStatus... allowed) {
        for (var status : ExerciseStatus.values()) {
            var set = set(ExerciseType.MULTIPLE_CHOICE, status);
            if (List.of(allowed).contains(status)) assertThatCode(() -> action.accept(set)).as(status.name()).doesNotThrowAnyException();
            else assertCode(() -> action.accept(set), ErrorCode.EXERCISE_STATE_INVALID);
        }
    }

    @Test
    void authorTransitionsAreOnlyAllowedFromTheirSourceStates() {
        only(s -> s.submit(3), DRAFT, CHANGES_REQUESTED);
        only(ExerciseSet::withdraw, PENDING);
        only(ExerciseSet::authorHide, PUBLISHED);
        only(ExerciseSet::authorUnhide, AUTHOR_HIDDEN);
    }

    @Test
    void moderatorTransitionsAreOnlyAllowedFromTheirSourceStates() {
        only(s -> s.approve(null, null), PENDING);
        only(s -> s.requestChanges(null, "fix"), PENDING);
        only(s -> s.moderatorHide(null, "why"), PUBLISHED, AUTHOR_HIDDEN);
        only(s -> s.moderatorRestore(null, null), HIDDEN);
        only(s -> s.remove(null, "why"), PUBLISHED, AUTHOR_HIDDEN, HIDDEN);
    }

    @Test
    void transitionsSetTheirResultingStateAndBumpTheVersion() {
        var set = set(ExerciseType.MULTIPLE_CHOICE, DRAFT);
        set.submit(3);
        assertThat(set.getStatus()).isEqualTo(PENDING);
        assertThat(set.getVersion()).isEqualTo(1);
        set.approve(null, "ok");
        assertThat(set.getStatus()).isEqualTo(PUBLISHED);
        assertThat(set.getPublishedAt()).isNotNull();
        var firstPublished = set.getPublishedAt();
        set.authorHide();
        assertThat(set.getStatus()).isEqualTo(AUTHOR_HIDDEN);
        set.moderatorHide(null, "bad");
        assertThat(set.getStatus()).isEqualTo(HIDDEN);
        assertThat(set.getHiddenFromStatus()).isEqualTo(AUTHOR_HIDDEN);
        set.moderatorRestore(null, null);
        assertThat(set.getStatus()).isEqualTo(AUTHOR_HIDDEN);
        assertThat(set.getHiddenFromStatus()).isNull();
        set.authorUnhide();
        set.moderatorHide(null, "bad");
        assertThat(set.getHiddenFromStatus()).isEqualTo(PUBLISHED);
        set.remove(null, "gone");
        assertThat(set.getStatus()).isEqualTo(REMOVED);
        assertThat(set.getHiddenFromStatus()).isNull();
        assertThat(set.getPublishedAt()).isEqualTo(firstPublished);
        assertThat(set.getVersion()).isEqualTo(8);
    }

    @Test
    void submitNeedsThreeQuestionsOrFiveCards() {
        assertCode(() -> set(ExerciseType.MULTIPLE_CHOICE, DRAFT).submit(2), ErrorCode.EXERCISE_NOT_READY);
        assertThatCode(() -> set(ExerciseType.MULTIPLE_CHOICE, DRAFT).submit(3)).doesNotThrowAnyException();
        assertCode(() -> set(ExerciseType.FLASHCARD, CHANGES_REQUESTED).submit(4), ErrorCode.EXERCISE_NOT_READY);
        assertThatCode(() -> set(ExerciseType.FLASHCARD, CHANGES_REQUESTED).submit(5)).doesNotThrowAnyException();
        // State is checked before readiness.
        assertCode(() -> set(ExerciseType.MULTIPLE_CHOICE, PENDING).submit(0), ErrorCode.EXERCISE_STATE_INVALID);
    }

    @Test
    void editableOnlyInDraftOrChangesRequested() {
        for (var status : ExerciseStatus.values()) {
            var set = set(ExerciseType.MULTIPLE_CHOICE, status);
            if (status == DRAFT || status == CHANGES_REQUESTED) assertThatCode(set::ensureEditable).doesNotThrowAnyException();
            else assertCode(set::ensureEditable, ErrorCode.EXERCISE_NOT_EDITABLE);
        }
    }

    @Test
    void deletableOnlyWhenNeverPublishedAndNotPending() {
        for (var status : ExerciseStatus.values()) {
            var set = set(ExerciseType.MULTIPLE_CHOICE, status);
            boolean ok = status == DRAFT || status == CHANGES_REQUESTED;
            if (ok) assertThatCode(set::ensureDeletable).as(status.name()).doesNotThrowAnyException();
            else assertCode(set::ensureDeletable, ErrorCode.EXERCISE_NOT_DELETABLE);
        }
        // A draft that was published once (published_at kept) cannot be deleted either.
        var wasPublished = set(ExerciseType.MULTIPLE_CHOICE, DRAFT);
        ReflectionTestUtils.setField(wasPublished, "publishedAt", java.time.Instant.now());
        assertCode(wasPublished::ensureDeletable, ErrorCode.EXERCISE_NOT_DELETABLE);
    }

    // ------------------------------------------------------------ question validation

    static Question mc(String content, List<String> options, Integer correct, String explanation) {
        return new Question(content, null, null, options, correct, explanation, null, null);
    }

    static Question okMc() {
        return mc("What is 1+1?", List.of("1", "2"), 1, "Because.");
    }

    static Question card(String front, String back, String explanation) {
        return new Question(null, null, null, null, null, explanation, front, back);
    }

    static Map<String, String> errors(ExerciseType type, List<Question> questions) {
        try {
            AuthorExerciseService.normalize(type, questions);
            return Map.of();
        } catch (CustomException e) {
            assertThat(e.getErrorCode()).isEqualTo(ErrorCode.EXERCISE_QUESTIONS_INVALID);
            return e.getFieldErrors();
        }
    }

    static Map<String, String> mcErrors(Question q) {
        return errors(ExerciseType.MULTIPLE_CHOICE, List.of(q));
    }

    @Test
    void acceptsValidMultipleChoiceAndTrims() {
        var out = AuthorExerciseService.normalize(ExerciseType.MULTIPLE_CHOICE,
                List.of(mc("  Q  ", List.of(" a ", "b"), 0, " E ")));
        assertThat(out.get(0).content()).isEqualTo("Q");
        assertThat(out.get(0).options()).containsExactly("a", "b");
        assertThat(out.get(0).explanation()).isEqualTo("E");
    }

    @Test
    void multipleChoiceFieldRules() {
        assertThat(mcErrors(okMc())).isEmpty();
        assertThat(mcErrors(mc(" ", List.of("1", "2"), 0, "e"))).containsKey("questions[0].content");
        assertThat(mcErrors(mc("x".repeat(2001), List.of("1", "2"), 0, "e"))).containsKey("questions[0].content");
        assertThat(mcErrors(mc("q", List.of("1"), 0, "e"))).containsKey("questions[0].options");
        assertThat(mcErrors(mc("q", List.of("1", "2", "3", "4", "5", "6"), 0, "e"))).isEmpty();
        assertThat(mcErrors(mc("q", List.of("1", "2", "3", "4", "5", "6", "7"), 0, "e"))).containsKey("questions[0].options");
        assertThat(mcErrors(mc("q", List.of("1", " "), 0, "e"))).containsKey("questions[0].options");
        assertThat(mcErrors(mc("q", List.of("1", "x".repeat(501)), 0, "e"))).containsKey("questions[0].options");
        assertThat(mcErrors(mc("q", List.of("a", " a "), 0, "e"))).containsKey("questions[0].options");
        assertThat(mcErrors(mc("q", List.of("1", "2"), 2, "e"))).containsKey("questions[0].correctIndex");
        assertThat(mcErrors(mc("q", List.of("1", "2"), -1, "e"))).containsKey("questions[0].correctIndex");
        assertThat(mcErrors(mc("q", List.of("1", "2"), null, "e"))).containsKey("questions[0].correctIndex");
        assertThat(mcErrors(mc("q", List.of("1", "2"), 0, " "))).containsKey("questions[0].explanation");
        assertThat(mcErrors(mc("q", List.of("1", "2"), 0, "x".repeat(2001)))).containsKey("questions[0].explanation");
        // Snippet: <= 5000 and needs a language of 1-50.
        assertThat(mcErrors(new Question("q", "code", null, List.of("1", "2"), 0, "e", null, null))).containsKey("questions[0].codeLanguage");
        assertThat(mcErrors(new Question("q", "code", "x".repeat(51), List.of("1", "2"), 0, "e", null, null))).containsKey("questions[0].codeLanguage");
        assertThat(mcErrors(new Question("q", "x".repeat(5001), "java", List.of("1", "2"), 0, "e", null, null))).containsKey("questions[0].codeSnippet");
        assertThat(mcErrors(new Question("q", "x".repeat(5000), "java", List.of("1", "2"), 0, "e", null, null))).isEmpty();
        // Flashcard fields are not accepted on a multiple choice set.
        assertThat(mcErrors(new Question("q", null, null, List.of("1", "2"), 0, "e", "front", null))).containsKey("questions[0].front");
    }

    @Test
    void flashcardFieldRules() {
        assertThat(errors(ExerciseType.FLASHCARD, List.of(card("f", "b", null)))).isEmpty();
        assertThat(errors(ExerciseType.FLASHCARD, List.of(card(" ", "b", null)))).containsKey("questions[0].front");
        assertThat(errors(ExerciseType.FLASHCARD, List.of(card("f", "x".repeat(1001), null)))).containsKey("questions[0].back");
        assertThat(errors(ExerciseType.FLASHCARD, List.of(card("f", "b", "x".repeat(2001))))).containsKey("questions[0].explanation");
        assertThat(errors(ExerciseType.FLASHCARD, List.of(new Question(null, null, null, List.of("a", "b"), 0, null, "f", "b"))))
                .containsKeys("questions[0].options", "questions[0].correctIndex");
        assertThat(errors(ExerciseType.FLASHCARD, List.of(new Question("legacy", null, null, null, null, null, "f", "b"))))
                .containsKey("questions[0].content");
        // Missing explanation is stored as an empty string.
        assertThat(AuthorExerciseService.normalize(ExerciseType.FLASHCARD, List.of(card("f", "b", null))).get(0).explanation()).isEmpty();
    }

    @Test
    void questionCountBounds() {
        var fifty = IntStream.range(0, 50).mapToObj(i -> okMc()).toList();
        assertThat(errors(ExerciseType.MULTIPLE_CHOICE, fifty)).isEmpty();
        assertThat(errors(ExerciseType.MULTIPLE_CHOICE, List.of())).isEmpty();
        var tooMany = IntStream.range(0, 51).mapToObj(i -> okMc()).toList();
        assertThat(errors(ExerciseType.MULTIPLE_CHOICE, tooMany)).containsKey("questions");
    }

    @Test
    void reportsEveryBadQuestionByItsIndexAndRejectsNullEntries() {
        var errors = errors(ExerciseType.MULTIPLE_CHOICE, List.of(okMc(), mc(" ", List.of("1", "2"), 0, "e"), okMc(), mc("q", List.of("1"), 0, "e")));
        assertThat(errors).containsKeys("questions[1].content", "questions[3].options").doesNotContainKey("questions[0].content");
        assertThat(errors(ExerciseType.MULTIPLE_CHOICE, Arrays.asList(okMc(), null))).containsKey("questions[1]");
    }
}
