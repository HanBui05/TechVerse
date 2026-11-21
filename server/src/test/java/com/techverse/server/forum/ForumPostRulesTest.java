package com.techverse.server.forum;

import static com.techverse.server.enums.ForumPostStatus.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.techverse.server.dto.response.ForumResponse.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.ForumPostStatus;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.ArticleContentService;
import com.techverse.server.service.impl.ForumService;
import com.techverse.server.service.impl.ForumService.RateKind;
import com.techverse.server.service.impl.ReportService;
import com.techverse.server.dto.request.ReportRequest;

import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

/** Pure forum rules: who sees what, "solved", viewer flags, Markdown checks and the posting rate. */
class ForumPostRulesTest {
    final UUID ownerId = UUID.randomUUID();
    final UUID otherId = UUID.randomUUID();
    final User owner = user(ownerId);
    final User other = user(otherId);
    final Topic topic = topic();

    static User user(UUID id) {
        var u = User.createLocalAccount("U", id + "@example.com", "x");
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    static Topic topic() {
        try {
            var c = Topic.class.getDeclaredConstructor();
            c.setAccessible(true);
            var t = c.newInstance();
            ReflectionTestUtils.setField(t, "id", UUID.randomUUID());
            return t;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    ForumPost question(ForumPostStatus status) {
        var q = ForumPost.question(owner, topic, "How do I use JPA locks?", "Some body text here");
        ReflectionTestUtils.setField(q, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(q, "status", status);
        return q;
    }

    ForumPost answer(ForumPost q, User by, ForumPostStatus status) {
        var a = ForumPost.answer(by, q, "Use PESSIMISTIC_WRITE");
        ReflectionTestUtils.setField(a, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(a, "status", status);
        return a;
    }

    // ------------------------------------------------------------------ who sees what

    @Test
    void questionIsReadableWhenVisibleOrDeletedWithVisibleAnswers() {
        assertThat(ForumService.questionReadable(question(VISIBLE), false)).isTrue();
        assertThat(ForumService.questionReadable(question(HIDDEN), true)).isFalse();
        assertThat(ForumService.questionReadable(question(DELETED), true)).isTrue();
        assertThat(ForumService.questionReadable(question(DELETED), false)).isFalse();
    }

    @Test
    void answerFollowsItsQuestion() {
        for (var qs : ForumPostStatus.values())
            for (var as : ForumPostStatus.values()) {
                var a = answer(question(qs), other, as);
                assertThat(ForumService.answerReadable(a)).as(qs + "/" + as).isEqualTo(as == VISIBLE && qs != HIDDEN);
            }
    }

    @Test
    void solvedOnlyWhileTheAcceptedAnswerIsVisible() {
        var q = question(VISIBLE);
        assertThat(ForumService.solved(q)).isFalse();
        var a = answer(q, other, VISIBLE);
        q.accept(a);
        assertThat(ForumService.solved(q)).isTrue();
        ReflectionTestUtils.setField(a, "status", HIDDEN);
        assertThat(ForumService.solved(q)).isFalse();
        ReflectionTestUtils.setField(a, "status", VISIBLE);
        assertThat(ForumService.solved(q)).isTrue();
        ReflectionTestUtils.setField(a, "status", DELETED);
        assertThat(ForumService.solved(q)).isFalse();
    }

    // ------------------------------------------------------------------ viewer flags

    @Test
    void questionViewerFlags() {
        var q = question(VISIBLE);
        assertThat(ForumService.questionViewer(q, null, false)).isEqualTo(new QuestionViewer(false, false, false, false, false, false));
        assertThat(ForumService.questionViewer(q, ownerId, false)).isEqualTo(new QuestionViewer(true, true, false, true, true, true));
        assertThat(ForumService.questionViewer(q, otherId, false)).isEqualTo(new QuestionViewer(false, false, true, false, true, true));
        assertThat(ForumService.questionViewer(q, otherId, true)).isEqualTo(new QuestionViewer(false, false, false, false, true, true));
        // Deleted but still shown: nothing left to do on the question itself.
        var deleted = question(DELETED);
        assertThat(ForumService.questionViewer(deleted, ownerId, false)).isEqualTo(new QuestionViewer(false, false, false, false, false, false));
        assertThat(ForumService.questionViewer(deleted, otherId, false)).isEqualTo(new QuestionViewer(false, false, false, false, false, false));
    }

    @Test
    void answerViewerFlags() {
        var q = question(VISIBLE);
        var mine = answer(q, owner, VISIBLE);
        var theirs = answer(q, other, VISIBLE);
        assertThat(ForumService.answerViewer(theirs, null, false)).isEqualTo(new PostViewer(false, false, false, false));
        assertThat(ForumService.answerViewer(mine, ownerId, false)).isEqualTo(new PostViewer(true, true, false, true));
        assertThat(ForumService.answerViewer(theirs, ownerId, false)).isEqualTo(new PostViewer(false, false, true, true));
        assertThat(ForumService.answerViewer(theirs, ownerId, true)).isEqualTo(new PostViewer(false, false, false, true));
        // Answers under a deleted question stay editable, deletable and reportable.
        var underDeleted = answer(question(DELETED), other, VISIBLE);
        assertThat(ForumService.answerViewer(underDeleted, otherId, false)).isEqualTo(new PostViewer(true, true, false, true));
        assertThat(ForumService.answerViewer(underDeleted, ownerId, false)).isEqualTo(new PostViewer(false, false, true, true));
    }

    @Test
    void canReactFollowsWhatReadersSeeAndNeedsAnActiveViewer() {
        // Readable posts only (callers 404 the rest); a deleted question still shown takes no reaction, its answers do.
        for (var qs : new ForumPostStatus[] {VISIBLE, DELETED}) {
            var q = question(qs);
            assertThat(ForumService.questionViewer(q, otherId, false).canReact()).as("question %s", qs).isEqualTo(qs == VISIBLE);
            assertThat(ForumService.questionViewer(q, ownerId, false).canReact()).as("own question %s", qs).isEqualTo(qs == VISIBLE);
            assertThat(ForumService.questionViewer(q, null, false).canReact()).isFalse();
            var a = answer(q, other, VISIBLE);
            assertThat(ForumService.answerViewer(a, ownerId, true).canReact()).as("answer under %s", qs).isTrue();
            assertThat(ForumService.answerViewer(a, otherId, false).canReact()).as("own answer under %s", qs).isTrue();
            assertThat(ForumService.answerViewer(a, null, false).canReact()).isFalse();
        }
    }

    // ------------------------------------------------------------------ content

    final ForumService content = new ForumService(null, new ArticleContentService(), null, null, null, null, null, null);

    @Test
    void plainMarkdownPasses() {
        assertThatCode(() -> content.checkContent("**JPA** dùng `@Lock`.\n\n```java\nint x = 1;\n```\n\n[docs](https://spring.io)"))
                .doesNotThrowAnyException();
    }

    @Test
    void rawHtmlDangerousLinksNulAndEveryImageAreRejected() {
        for (String bad : new String[] {
                "<script>alert(1)</script>",
                "Xem <b>đậm</b>",
                "[click](javascript:alert(1))",
                "a\u0000b",
                "![pic](https://example.com/a.png)",
                "![pic][ref]\n\n[ref]: https://example.com/a.png",
                "![]()"})
            assertThatThrownBy(() -> content.checkContent(bad))
                    .as(bad)
                    .isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.FORUM_CONTENT_INVALID));
    }

    // ------------------------------------------------------------------ rate

    @SuppressWarnings("unchecked")
    ForumService limiter(Object reply) {
        var redis = mock(StringRedisTemplate.class);
        var stub = when(redis.execute(any(RedisScript.class), anyList(), any(Object[].class)));
        if (reply instanceof RuntimeException e) stub.thenThrow(e);
        else stub.thenReturn(reply);
        return new ForumService(null, null, null, null, null, null, null, redis);
    }

    @Test
    void rateLimitAllowsUpToTheLimitPerMinute() {
        assertThatCode(() -> limiter(3L).rateLimit(ownerId, RateKind.QUESTION)).doesNotThrowAnyException();
        assertThatCode(() -> limiter(10L).rateLimit(ownerId, RateKind.ANSWER)).doesNotThrowAnyException();
        assertThatCode(() -> limiter(10L).rateLimit(ownerId, RateKind.REPORT)).doesNotThrowAnyException();
        assertThatCode(() -> limiter(30L).rateLimit(ownerId, RateKind.REACT)).doesNotThrowAnyException();
    }

    @Test
    void rateLimitRejectsAboveTheLimitAndFailsClosedWhenRedisIsDown() {
        assertCode(() -> limiter(4L).rateLimit(ownerId, RateKind.QUESTION), ErrorCode.FORUM_RATE_LIMITED);
        assertCode(() -> limiter(11L).rateLimit(ownerId, RateKind.ANSWER), ErrorCode.FORUM_RATE_LIMITED);
        assertCode(() -> limiter(11L).rateLimit(ownerId, RateKind.REPORT), ErrorCode.FORUM_RATE_LIMITED);
        assertCode(() -> limiter(31L).rateLimit(ownerId, RateKind.REACT), ErrorCode.FORUM_RATE_LIMITED);
        assertCode(() -> limiter(new QueryTimeoutException("down")).rateLimit(ownerId, RateKind.REACT), ErrorCode.FORUM_STORAGE_UNAVAILABLE);
        assertCode(() -> limiter(null).rateLimit(ownerId, RateKind.QUESTION), ErrorCode.FORUM_STORAGE_UNAVAILABLE);
        assertCode(() -> limiter(new QueryTimeoutException("down")).rateLimit(ownerId, RateKind.ANSWER), ErrorCode.FORUM_STORAGE_UNAVAILABLE);
    }

    static void assertCode(ThrowingCallable call, ErrorCode code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }

    @Test
    void reportTargetsFollowWhatReadersSee() {
        for (var qs : ForumPostStatus.values()) {
            var q = question(qs);
            assertThat(ReportService.reportable(q)).as("question %s", qs).isEqualTo(qs == VISIBLE);
            for (var as : ForumPostStatus.values())
                assertThat(ReportService.reportable(answer(q, other, as))).as("answer %s under %s", as, qs).isEqualTo(as == VISIBLE && qs != HIDDEN);
        }
        // Owning the post is refused separately (REPORT_OWN_CONTENT), after the visibility check.
        assertThat(question(VISIBLE).isOwnedBy(ownerId)).isTrue();
    }

    @Test
    void moderatorNotesAndVisibilityTransitions() {
        assertThat(ReportRequest.noteValid(true, null)).isFalse();
        assertThat(ReportRequest.noteValid(true, "Spam")).isTrue();
        assertThat(ReportRequest.noteValid(false, null)).isTrue();
        assertThat(ReportRequest.noteValid(false, "a b")).isFalse();
        assertThat(new ReportRequest.Resolve("HIDE_CONTENT", "   ").isNoteValid()).isFalse();
        assertThat(new ReportRequest.Resolve("DISMISS", "   ").note()).isNull();
        assertThat(new ReportRequest.Visibility("HIDE", " Off-topic ").note()).isEqualTo("Off-topic");
        assertThat(new ReportRequest.Visibility("RESTORE", null).isNoteValid()).isTrue();

        assertThat(ReportService.transitionAllowed(VISIBLE, true)).isTrue();
        assertThat(ReportService.transitionAllowed(HIDDEN, true)).isFalse();
        assertThat(ReportService.transitionAllowed(DELETED, true)).isFalse();
        assertThat(ReportService.transitionAllowed(HIDDEN, false)).isTrue();
        assertThat(ReportService.transitionAllowed(VISIBLE, false)).isFalse();
        assertThat(ReportService.transitionAllowed(DELETED, false)).isFalse();

        var q = question(VISIBLE);
        q.hide(other, "Spam");
        assertThat(q.getStatus()).isEqualTo(HIDDEN);
        assertThat(q.getHiddenBy()).isSameAs(other);
        q.restore(null);
        assertThat(q.getStatus()).isEqualTo(VISIBLE);
        assertThat(q.getHiddenBy()).isNull();
        assertThat(q.getHiddenAt()).isNull();
        assertThat(q.getModerationNote()).isEqualTo("Spam");
    }
}
