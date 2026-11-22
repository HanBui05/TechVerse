package com.techverse.server.messaging;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.techverse.server.entity.*;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.ArticleContentService;
import com.techverse.server.service.impl.ConversationService;
import com.techverse.server.service.impl.ConversationService.RateKind;

import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;

/** Pure messaging rules: who gets in, what may be sent, read markers, context course, pages, client ids, content and rate. */
class ConversationRulesTest {
    final User learner = user();
    final User author = user();
    final User outsider = user();

    static <T> T instance(Class<T> type) {
        try {
            var c = type.getDeclaredConstructor();
            c.setAccessible(true);
            return c.newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    static User user(RoleName... roles) {
        UUID id = UUID.randomUUID();
        var u = User.createLocalAccount("U", id + "@example.com", "x");
        ReflectionTestUtils.setField(u, "id", id);
        for (var name : roles) {
            var role = instance(Role.class);
            ReflectionTestUtils.setField(role, "name", name);
            u.addRole(role);
        }
        return u;
    }

    Conversation conversation() {
        var c = instance(Conversation.class);
        ReflectionTestUtils.setField(c, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(c, "learner", learner);
        ReflectionTestUtils.setField(c, "author", author);
        ReflectionTestUtils.setField(c, "contextCourseTitle", "Spring Boot");
        return c;
    }

    static Message message(UUID conversation, UUID sender, long seq, String content) {
        var m = instance(Message.class);
        ReflectionTestUtils.setField(m, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(m, "conversationId", conversation);
        ReflectionTestUtils.setField(m, "senderId", sender);
        ReflectionTestUtils.setField(m, "content", content);
        ReflectionTestUtils.setField(m, "seq", seq);
        ReflectionTestUtils.setField(m, "createdAt", Instant.now());
        return m;
    }

    static void assertCode(ThrowingCallable call, ErrorCode code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }

    // ------------------------------------------------------------------ access

    @Test
    void staffAndLockedAccountsAreDeniedBeforeParticipationIsChecked() {
        for (var denied : List.of(user(RoleName.ADMIN), user(RoleName.MODERATOR), user(RoleName.AUTHOR, RoleName.MODERATOR),
                user(RoleName.LEARNER, RoleName.ADMIN)))
            assertCode(() -> ConversationService.checkReader(denied), ErrorCode.ACCESS_DENIED);
        var locked = user();
        locked.updateActiveStatus(false);
        assertCode(() -> ConversationService.checkReader(locked), ErrorCode.ACCESS_DENIED);
        assertCode(() -> ConversationService.checkReader(null), ErrorCode.ACCESS_DENIED);
        assertThatCode(() -> ConversationService.checkReader(user(RoleName.AUTHOR))).doesNotThrowAnyException();
        assertThatCode(() -> ConversationService.checkReader(user(RoleName.LEARNER))).doesNotThrowAnyException();

        var c = conversation();
        assertThat(ConversationService.participant(Optional.of(c), learner.getId())).isSameAs(c);
        assertThat(ConversationService.participant(Optional.of(c), author.getId())).isSameAs(c);
        assertCode(() -> ConversationService.participant(Optional.of(c), outsider.getId()), ErrorCode.CONVERSATION_NOT_FOUND);
        assertCode(() -> ConversationService.participant(Optional.empty(), learner.getId()), ErrorCode.CONVERSATION_NOT_FOUND);
    }

    // ------------------------------------------------------------------ sending

    @Test
    void learnerSendsThreeBeforeTheFirstReplyAndBlocksOrLocksStopEveryone() {
        assertThat(ConversationService.remainingBeforeReply(true, false, 0)).isEqualTo(3);
        assertThat(ConversationService.remainingBeforeReply(true, false, 2)).isEqualTo(1);
        assertThat(ConversationService.remainingBeforeReply(true, false, 3)).isZero();
        assertThat(ConversationService.remainingBeforeReply(true, false, 5)).isZero();
        assertThat(ConversationService.remainingBeforeReply(true, true, 3)).isNull();
        assertThat(ConversationService.remainingBeforeReply(false, false, 0)).isNull();

        var c = conversation();
        assertThat(ConversationService.sendBlock(c, 3)).isNull();
        assertThat(ConversationService.sendBlock(c, null)).isNull();
        assertThat(ConversationService.sendBlock(c, 0)).isEqualTo(ErrorCode.CONVERSATION_AWAITING_REPLY);
        ReflectionTestUtils.setField(c, "lockedAt", Instant.now());
        assertThat(ConversationService.sendBlock(c, null)).isEqualTo(ErrorCode.CONVERSATION_LOCKED);
        ReflectionTestUtils.setField(c, "blockedBy", author.getId());
        ReflectionTestUtils.setField(c, "blockedAt", Instant.now());
        assertThat(ConversationService.sendBlock(c, 3)).isEqualTo(ErrorCode.CONVERSATION_BLOCKED);
    }

    @Test
    void authorMessageMarksTheReplyAndUpdatesTheLastMessage() {
        var c = conversation();
        c.recordMessage(message(c.getId(), learner.getId(), 5, "Hi"));
        assertThat(c.isAuthorReplied()).isFalse();
        assertThat(c.getLastMessageSeq()).isEqualTo(5);
        c.recordMessage(message(c.getId(), author.getId(), 9, "Hello"));
        assertThat(c.isAuthorReplied()).isTrue();
        assertThat(c.getLastMessageSenderId()).isEqualTo(author.getId());
    }

    @Test
    void aRepeatedClientIdIsTheSameRequestOnlyInTheSameConversationWithTheSameContent() {
        var c = conversation();
        var m = message(c.getId(), learner.getId(), 1, "Hello");
        assertThat(ConversationService.sameRequest(m, c.getId(), "Hello")).isSameAs(m);
        assertCode(() -> ConversationService.sameRequest(m, c.getId(), "Hello!"), ErrorCode.MESSAGE_CLIENT_ID_CONFLICT);
        assertCode(() -> ConversationService.sameRequest(m, UUID.randomUUID(), "Hello"), ErrorCode.MESSAGE_CLIENT_ID_CONFLICT);
    }

    // ------------------------------------------------------------------ reading

    @Test
    void unreadMeansTheOtherSideWroteLastAfterMyMarkerAndMarkersNeverGoBack() {
        var c = conversation();
        assertThat(ConversationService.unread(c, learner.getId())).isFalse();
        c.recordMessage(message(c.getId(), learner.getId(), 4, "Hi"));
        assertThat(ConversationService.unread(c, learner.getId())).isFalse();
        assertThat(ConversationService.unread(c, author.getId())).isTrue();
        c.markRead(author.getId(), 4);
        assertThat(ConversationService.unread(c, author.getId())).isFalse();
        assertThat(c.getLearnerLastReadSeq()).isZero();

        assertThat(ConversationService.nextReadSeq(4, 2, 10L)).isEqualTo(4);
        assertThat(ConversationService.nextReadSeq(4, 7, 10L)).isEqualTo(7);
        assertThat(ConversationService.nextReadSeq(4, Long.MAX_VALUE, 10L)).isEqualTo(10);
        assertThat(ConversationService.nextReadSeq(0, 5, null)).isZero();
    }

    @Test
    void contextCourseKeepsTheTitleWhenDeletedOrHidden() {
        var c = conversation();
        var deleted = ConversationService.contextCourse(c, true);
        assertThat(deleted.id()).isNull();
        assertThat(deleted.title()).isEqualTo("Spring Boot");
        assertThat(deleted.available()).isFalse();

        var course = instance(Course.class);
        UUID courseId = UUID.randomUUID();
        ReflectionTestUtils.setField(course, "id", courseId);
        ReflectionTestUtils.setField(c, "contextCourse", course);
        assertThat(ConversationService.contextCourse(c, false)).isEqualTo(new com.techverse.server.dto.response.ConversationResponse.ContextCourse(
                courseId, "Spring Boot", false));
        assertThat(ConversationService.contextCourse(c, true).available()).isTrue();
    }

    @Test
    void pagesAreAscendingWithHasMoreAndExcerptsCountCodePoints() {
        UUID c = UUID.randomUUID();
        var newestFirst = List.of(message(c, learner.getId(), 9, "c"), message(c, author.getId(), 7, "b"), message(c, learner.getId(), 3, "a"));
        var latest = ConversationService.page(newestFirst, 2, true, learner.getId());
        assertThat(latest.messages()).extracting(m -> m.seq()).containsExactly(7L, 9L);
        assertThat(latest.hasMore()).isTrue();
        assertThat(latest.messages()).extracting(m -> m.mine()).containsExactly(false, true);
        assertThat(ConversationService.page(newestFirst, 3, true, learner.getId()).hasMore()).isFalse();
        var oldestFirst = List.of(message(c, learner.getId(), 3, "a"), message(c, author.getId(), 7, "b"), message(c, learner.getId(), 9, "c"));
        var after = ConversationService.page(oldestFirst, 2, false, learner.getId());
        assertThat(after.messages()).extracting(m -> m.seq()).containsExactly(3L, 7L);
        assertThat(after.hasMore()).isTrue();
        assertThat(ConversationService.page(List.of(), 30, true, learner.getId()).messages()).isEmpty();

        assertThat(ConversationService.excerpt("short")).isEqualTo("short");
        String emoji = "😀".repeat(130);
        assertThat(ConversationService.excerpt(emoji).codePointCount(0, ConversationService.excerpt(emoji).length())).isEqualTo(120);
    }

    // ------------------------------------------------------------------ content and rate

    final ConversationService content = new ConversationService(null, new ArticleContentService(), null, null, null, null, null);

    @Test
    void markdownWithCodeIsAcceptedButHtmlUnsafeLinksNulAndImagesAreNot() {
        assertThatCode(() -> content.checkContent("**JPA** dùng `@Lock`.\n\n```java\nint x = 1;\n```\n\n[docs](https://spring.io)"))
                .doesNotThrowAnyException();
        for (String bad : new String[] {"<script>alert(1)</script>", "Xem <b>đậm</b>", "[click](javascript:alert(1))", "a\u0000b",
                "![pic](https://example.com/a.png)"})
            assertCode(() -> content.checkContent(bad), ErrorCode.MESSAGE_CONTENT_INVALID);
    }

    ConversationService limiter(Object reply) {
        var redis = mock(StringRedisTemplate.class);
        var stub = when(redis.execute(any(RedisScript.class), anyList(), any(Object[].class)));
        if (reply instanceof RuntimeException e) stub.thenThrow(e);
        else stub.thenReturn(reply);
        return new ConversationService(null, null, null, null, null, null, redis);
    }

    @Test
    void rateIsTwentySendsAndFiveOpensPerMinuteAndFailsClosed() {
        UUID me = learner.getId();
        assertThatCode(() -> limiter(20L).rateLimit(me, RateKind.SEND)).doesNotThrowAnyException();
        assertThatCode(() -> limiter(5L).rateLimit(me, RateKind.OPEN)).doesNotThrowAnyException();
        assertCode(() -> limiter(21L).rateLimit(me, RateKind.SEND), ErrorCode.MESSAGE_RATE_LIMITED);
        assertCode(() -> limiter(6L).rateLimit(me, RateKind.OPEN), ErrorCode.MESSAGE_RATE_LIMITED);
        assertCode(() -> limiter(null).rateLimit(me, RateKind.SEND), ErrorCode.MESSAGE_STORAGE_UNAVAILABLE);
        assertCode(() -> limiter(new QueryTimeoutException("down")).rateLimit(me, RateKind.OPEN), ErrorCode.MESSAGE_STORAGE_UNAVAILABLE);
    }
}
