package com.techverse.server.messaging;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.techverse.server.configuration.MessageSocketHandler;
import com.techverse.server.entity.*;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.*;
import com.techverse.server.properties.OAuth2Properties;
import com.techverse.server.repository.AuthSessionRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.impl.ArticleContentService;
import com.techverse.server.service.impl.ConversationService;
import com.techverse.server.service.impl.ConversationService.RateKind;
import com.techverse.server.service.impl.ReportService;

import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.CountDownLatch;

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

    // ------------------------------------------------------------------ blocking and moderation

    @Test
    void onlyTheBlockerLiftsABlockAndRepeatsAreNoOps() {
        for (var blocker : List.of(learner, author)) {
            var other = blocker == learner ? author : learner;
            var c = conversation();
            ConversationService.applyBlock(c, other.getId(), false);
            assertThat(c.isBlocked()).isFalse();
            ConversationService.applyBlock(c, blocker.getId(), true);
            ConversationService.applyBlock(c, blocker.getId(), true);
            assertThat(c.getBlockedBy()).isEqualTo(blocker.getId());
            assertThat(c.getBlockedAt()).isNotNull();
            assertCode(() -> ConversationService.applyBlock(c, other.getId(), true), ErrorCode.CONVERSATION_BLOCKED);
            assertCode(() -> ConversationService.applyBlock(c, other.getId(), false), ErrorCode.CONVERSATION_BLOCKED);
            ConversationService.applyBlock(c, blocker.getId(), false);
            assertThat(c.isBlocked()).isFalse();
            assertThat(c.getBlockedAt()).isNull();
        }
    }

    @Test
    void actionsFitTheirTargetTypeAndOnlyModeratorsModerate() {
        assertThat(ReportService.actionAllowed("CONVERSATION", "LOCK_CONVERSATION")).isTrue();
        assertThat(ReportService.actionAllowed("CONVERSATION", "DISMISS")).isTrue();
        assertThat(ReportService.actionAllowed("CONVERSATION", "HIDE_CONTENT")).isFalse();
        assertThat(ReportService.actionAllowed("FORUM_POST", "HIDE_CONTENT")).isTrue();
        assertThat(ReportService.actionAllowed("FORUM_POST", "DISMISS")).isTrue();
        assertThat(ReportService.actionAllowed("FORUM_POST", "LOCK_CONVERSATION")).isFalse();

        assertThatCode(() -> ConversationService.checkModerator(user(RoleName.MODERATOR))).doesNotThrowAnyException();
        assertThatCode(() -> ConversationService.checkModerator(user(RoleName.AUTHOR, RoleName.MODERATOR))).doesNotThrowAnyException();
        var locked = user(RoleName.MODERATOR);
        locked.updateActiveStatus(false);
        for (var denied : Arrays.asList(user(RoleName.ADMIN), user(RoleName.LEARNER), locked, null))
            assertCode(() -> ConversationService.checkModerator(denied), ErrorCode.ACCESS_DENIED);

        var c = conversation();
        c.lock(UUID.randomUUID(), true, "Abuse");
        assertThat(c.isLocked()).isTrue();
        assertThat(ConversationService.sendBlock(c, null)).isEqualTo(ErrorCode.CONVERSATION_LOCKED);
        c.lock(UUID.randomUUID(), false, null);
        assertThat(c.isLocked()).isFalse();
        assertThat(c.getLockedBy()).isNull();
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

    final ConversationService content = new ConversationService(null, new ArticleContentService(), null, null, null, null, null, null, null);

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
        return new ConversationService(null, null, null, null, null, null, null, redis, null);
    }

    @Test
    void rateIsTwentySendsFiveOpensAndTenTicketsPerMinuteAndFailsClosed() {
        UUID me = learner.getId();
        assertThatCode(() -> limiter(20L).rateLimit(me, RateKind.SEND)).doesNotThrowAnyException();
        assertThatCode(() -> limiter(5L).rateLimit(me, RateKind.OPEN)).doesNotThrowAnyException();
        assertThatCode(() -> limiter(10L).rateLimit(me, RateKind.TICKET)).doesNotThrowAnyException();
        assertCode(() -> limiter(21L).rateLimit(me, RateKind.SEND), ErrorCode.MESSAGE_RATE_LIMITED);
        assertCode(() -> limiter(6L).rateLimit(me, RateKind.OPEN), ErrorCode.MESSAGE_RATE_LIMITED);
        assertCode(() -> limiter(11L).rateLimit(me, RateKind.TICKET), ErrorCode.MESSAGE_RATE_LIMITED);
        assertCode(() -> limiter(null).rateLimit(me, RateKind.SEND), ErrorCode.MESSAGE_STORAGE_UNAVAILABLE);
        assertCode(() -> limiter(new QueryTimeoutException("down")).rateLimit(me, RateKind.OPEN), ErrorCode.MESSAGE_STORAGE_UNAVAILABLE);
    }

    // ------------------------------------------------------------------ socket events

    @Test
    void eventsGoToTheTwoParticipantsOnlyAndCarryNoContentTitleOrCount() {
        var c = conversation();
        UUID id = c.getId();
        assertThat(ConversationService.participants(c)).containsExactlyInAnyOrder(learner.getId(), author.getId()).doesNotContain(outsider.getId());
        assertThat(ConversationService.messageEvent(id, 7)).isEqualTo("{\"type\":\"message\",\"conversationId\":\"" + id + "\",\"seq\":7}");
        assertThat(ConversationService.stateEvent(id)).isEqualTo("{\"type\":\"state\",\"conversationId\":\"" + id + "\"}");
        assertThat(ConversationService.UNREAD_EVENT).isEqualTo("{\"type\":\"unread\"}");
    }

    @Test
    void aNewMessageSignalsUnreadOnlyToThoseWhoseUnreadStateFlips() {
        var c = conversation();
        UUID me = learner.getId(), them = author.getId();
        assertThat(ConversationService.unreadFlippedBySend(c, me)).containsExactly(them);
        c.recordMessage(message(c.getId(), me, 1, "hi"));
        assertThat(ConversationService.unreadFlippedBySend(c, me)).isEmpty();
        assertThat(ConversationService.unreadFlippedBySend(c, them)).containsExactlyInAnyOrder(me, them);
    }

    /** A live connection for {@code u} made through the real handshake checks, with mocked Redis, session and user lookups. */
    @SuppressWarnings("unchecked")
    static WebSocketSession connect(MessageSocketHandler h, StringRedisTemplate redis, AuthSessionRepository sessions, UserRepository users,
            User u, CountDownLatch blockUntil) throws Exception {
        String sid = "s-" + u.getId();
        var ops = (ValueOperations<String, String>) redis.opsForValue();
        Instant exp = Instant.now().plusSeconds(60);
        when(ops.getAndDelete("messaging:ticket:" + sid)).thenReturn(u.getId() + " " + sid + " " + exp.toEpochMilli());
        when(sessions.findById(sid)).thenReturn(Optional.of(AuthSession.builder().id(sid).userId(u.getId().toString()).expiresAt(exp).build()));
        when(users.findWithRolesById(u.getId())).thenReturn(Optional.of(u));
        var req = new MockHttpServletRequest();
        req.addHeader("Origin", "http://web");
        req.setParameter("ticket", sid);
        Map<String, Object> attrs = new HashMap<>();
        assertThat(h.beforeHandshake(new ServletServerHttpRequest(req), mock(ServerHttpResponse.class), h, attrs)).isTrue();
        var raw = mock(WebSocketSession.class);
        when(raw.getAttributes()).thenReturn(attrs);
        when(raw.getId()).thenReturn(sid);
        when(raw.isOpen()).thenReturn(true);
        if (blockUntil != null) doAnswer(i -> { blockUntil.await(); return null; }).when(raw).sendMessage(any());
        h.afterConnectionEstablished(raw);
        return raw;
    }

    @Test
    @SuppressWarnings("unchecked")
    void aConnectionThatStopsReadingDoesNotHoldUpOtherUsers() throws Exception {
        var redis = mock(StringRedisTemplate.class);
        when(redis.opsForValue()).thenReturn(mock(ValueOperations.class));
        var sessions = mock(AuthSessionRepository.class);
        var users = mock(UserRepository.class);
        var h = new MessageSocketHandler(redis, sessions, users, new OAuth2Properties("http://web"));
        var release = new CountDownLatch(1);
        try {
            var stuck = connect(h, redis, sessions, users, learner, release);
            var free = connect(h, redis, sessions, users, author, null);
            h.push(List.of(learner.getId()), "first");
            verify(stuck, timeout(2000)).sendMessage(new TextMessage("first"));
            h.push(List.of(learner.getId(), author.getId()), "second");
            verify(free, timeout(2000)).sendMessage(new TextMessage("second"));
        } finally {
            release.countDown();
        }
    }
}
