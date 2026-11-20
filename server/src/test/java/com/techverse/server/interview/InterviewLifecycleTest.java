package com.techverse.server.interview;

import static com.techverse.server.enums.InterviewStatus.*;
import static org.assertj.core.api.Assertions.*;

import com.techverse.server.entity.InterviewQuestion;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.function.Consumer;

/** Pure logic: interview question state machine, editability and deletability (no Spring). */
class InterviewLifecycleTest {
    static InterviewQuestion question(InterviewStatus status) {
        var q = InterviewQuestion.create(null, null, InterviewLevel.EASY, "What is a JVM?", "A virtual machine for bytecode.", null);
        ReflectionTestUtils.setField(q, "status", status);
        if (status == PUBLISHED || status == AUTHOR_HIDDEN || status == HIDDEN || status == REMOVED)
            ReflectionTestUtils.setField(q, "publishedAt", Instant.now());
        if (status == HIDDEN) ReflectionTestUtils.setField(q, "hiddenFromStatus", PUBLISHED);
        return q;
    }

    static void assertCode(Runnable action, ErrorCode code) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }

    /** Every status on which {@code action} works; all others must fail with STATE_INVALID. */
    static void only(Consumer<InterviewQuestion> action, InterviewStatus... allowed) {
        for (var status : InterviewStatus.values()) {
            var q = question(status);
            if (List.of(allowed).contains(status)) assertThatCode(() -> action.accept(q)).as(status.name()).doesNotThrowAnyException();
            else assertCode(() -> action.accept(q), ErrorCode.INTERVIEW_STATE_INVALID);
        }
    }

    @Test
    void authorTransitionsAreOnlyAllowedFromTheirSourceStates() {
        only(InterviewQuestion::submit, DRAFT, CHANGES_REQUESTED);
        only(InterviewQuestion::withdraw, PENDING);
        only(InterviewQuestion::authorHide, PUBLISHED);
        only(InterviewQuestion::authorUnhide, AUTHOR_HIDDEN);
    }

    @Test
    void moderatorTransitionsAreOnlyAllowedFromTheirSourceStates() {
        only(q -> q.approve(null, null), PENDING);
        only(q -> q.requestChanges(null, "fix"), PENDING);
        only(q -> q.moderatorHide(null, "why"), PUBLISHED, AUTHOR_HIDDEN);
        only(q -> q.moderatorRestore(null, null), HIDDEN);
        only(q -> q.remove(null, "why"), PUBLISHED, AUTHOR_HIDDEN, HIDDEN);
    }

    @Test
    void transitionsSetTheirResultingStateAndBumpTheVersion() {
        var q = question(DRAFT);
        q.submit();
        assertThat(q.getStatus()).isEqualTo(PENDING);
        assertThat(q.getVersion()).isEqualTo(1);
        q.withdraw();
        assertThat(q.getStatus()).isEqualTo(DRAFT);
        q.submit();
        q.requestChanges(null, "fix");
        assertThat(q.getStatus()).isEqualTo(CHANGES_REQUESTED);
        assertThat(q.getModerationNote()).isEqualTo("fix");
        q.submit();
        q.approve(null, "ok");
        assertThat(q.getStatus()).isEqualTo(PUBLISHED);
        var firstPublished = q.getPublishedAt();
        assertThat(firstPublished).isNotNull();
        q.authorHide();
        assertThat(q.getStatus()).isEqualTo(AUTHOR_HIDDEN);
        q.moderatorHide(null, "bad");
        assertThat(q.getHiddenFromStatus()).isEqualTo(AUTHOR_HIDDEN);
        q.moderatorRestore(null, null);
        assertThat(q.getStatus()).isEqualTo(AUTHOR_HIDDEN);
        assertThat(q.getHiddenFromStatus()).isNull();
        q.authorUnhide();
        q.moderatorHide(null, "bad");
        assertThat(q.getHiddenFromStatus()).isEqualTo(PUBLISHED);
        q.moderatorRestore(null, null);
        assertThat(q.getStatus()).isEqualTo(PUBLISHED);
        q.remove(null, "gone");
        assertThat(q.getStatus()).isEqualTo(REMOVED);
        assertThat(q.getHiddenFromStatus()).isNull();
        assertThat(q.getPublishedAt()).isEqualTo(firstPublished);
        assertThat(q.getVersion()).isEqualTo(13);
    }

    @Test
    void editableOnlyInDraftOrChangesRequestedAndEditBumpsTheVersion() {
        for (var status : InterviewStatus.values()) {
            var q = question(status);
            if (status == DRAFT || status == CHANGES_REQUESTED) assertThatCode(q::ensureEditable).doesNotThrowAnyException();
            else assertCode(q::ensureEditable, ErrorCode.INTERVIEW_NOT_EDITABLE);
        }
        var q = question(DRAFT);
        q.edit(null, InterviewLevel.HARD, null, null, "  ");
        assertThat(q.getLevel()).isEqualTo(InterviewLevel.HARD);
        assertThat(q.getQuestion()).isEqualTo("What is a JVM?");
        assertThat(q.getHint()).isNull();
        assertThat(q.getVersion()).isEqualTo(1);
        assertCode(() -> q.ensureVersion(0), ErrorCode.INTERVIEW_VERSION_CONFLICT);
        assertThatCode(() -> q.ensureVersion(1)).doesNotThrowAnyException();
    }

    @Test
    void deletableOnlyWhenNeverPublishedAndNotPending() {
        for (var status : InterviewStatus.values()) {
            var q = question(status);
            if (status == DRAFT || status == CHANGES_REQUESTED) assertThatCode(q::ensureDeletable).as(status.name()).doesNotThrowAnyException();
            else assertCode(q::ensureDeletable, ErrorCode.INTERVIEW_NOT_DELETABLE);
        }
        // A question published once (published_at kept) cannot be deleted even back in DRAFT.
        var was = question(DRAFT);
        ReflectionTestUtils.setField(was, "publishedAt", Instant.now());
        assertCode(was::ensureDeletable, ErrorCode.INTERVIEW_NOT_DELETABLE);
    }

    @Test
    void copyIsAFreshDraftKeepingContentAndTheAiFlag() {
        var src = question(PUBLISHED);
        ReflectionTestUtils.setField(src, "aiAssisted", true);
        ReflectionTestUtils.setField(src, "hint", "Think bytecode");
        var copy = src.copy();
        assertThat(copy.getStatus()).isEqualTo(DRAFT);
        assertThat(copy.getPublishedAt()).isNull();
        assertThat(copy.isAiAssisted()).isTrue();
        assertThat(copy.getHint()).isEqualTo("Think bytecode");
        assertThat(copy.getSampleAnswer()).isEqualTo(src.getSampleAnswer());
        assertThat(copy.getVersion()).isZero();
    }
}
