package com.techverse.server.service.impl;

import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ConversationResponse.*;
import com.techverse.server.entity.*;
import com.techverse.server.entity.Message;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.CourseSpecification;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Private learner–author conversations. Lock order on every write: the actor ({@link ArticleAccessService#lockActiveUser}),
 * then the conversation row; no other user is locked after the conversation. Only the two participants read or send;
 * any other reader account gets 404, staff and locked accounts 403 before the id is looked at. Contents are never logged.
 */
@Service
@RequiredArgsConstructor
public class ConversationService {
    static final int EXCERPT_CODE_POINTS = 120;
    static final int MESSAGES_BEFORE_REPLY = 3;
    private static final DefaultRedisScript<Long> COUNTER =
            new DefaultRedisScript<>(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
                    Long.class);

    private final ArticleAccessService access;
    private final ArticleContentService markdown;
    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final CourseRepository courses;
    private final UserRepository users;
    private final StringRedisTemplate redis;

    /** The stored (or found) message and whether this request created it (201) or repeated an earlier one (200). */
    public record Sent(ConversationResponse.Message message, boolean created) {}

    // ------------------------------------------------------------------ reads

    @Transactional(readOnly = true)
    public PageResponse<Summary> list(UUID actor, int page, int size) {
        reader(actor);
        var rows = conversations.findMine(actor, PageRequest.of(page, size));
        return PageResponse.from(rows, views(rows.getContent(), actor));
    }

    @Transactional(readOnly = true)
    public Detail detail(UUID actor, UUID id) {
        reader(actor);
        return detail(participant(conversations.findById(id), actor), actor);
    }

    @Transactional(readOnly = true)
    public Messages messages(UUID actor, UUID id, Long beforeSeq, Long afterSeq, int size) {
        reader(actor);
        participant(conversations.findById(id), actor);
        var limit = PageRequest.of(0, size + 1);
        List<Message> rows = afterSeq != null
                ? messages.findAfter(id, afterSeq, limit)
                : beforeSeq != null ? messages.findBefore(id, beforeSeq, limit) : messages.findLatest(id, limit);
        return page(rows, size, afterSeq == null, actor);
    }

    @Transactional(readOnly = true)
    public UnreadCount unreadCount(UUID actor) {
        reader(actor);
        return new UnreadCount(conversations.countUnread(actor));
    }

    // ------------------------------------------------------------------ writes

    /** Any public course whose author is someone else; no purchase needed. Reopening moves the context to this course. */
    @Transactional
    public Detail open(UUID actor, UUID courseId) {
        checkReader(access.lockActiveUser(actor));
        var course = courses.findOne(CourseSpecification.visibleCourse().and((r, q, cb) -> cb.equal(r.get("id"), courseId)))
                .orElseThrow(() -> new CustomException(ErrorCode.CONVERSATION_NOT_ALLOWED));
        var author = course.getAuthor();
        if (author.getId().equals(actor) || isStaff(author)) throw new CustomException(ErrorCode.CONVERSATION_NOT_ALLOWED);
        rateLimit(actor, RateKind.OPEN);
        conversations.upsert(actor, author.getId(), courseId, course.getPublishedVersion().getTitle());
        return detail(conversations.findPairForUpdate(actor, author.getId()).orElseThrow(), actor);
    }

    @Transactional
    public Sent send(UUID actor, UUID id, String content, UUID clientId) {
        checkContent(content);
        checkReader(access.lockActiveUser(actor));
        var c = participant(conversations.findByIdForUpdate(id), actor);
        // A repeated client id is answered before blocking, the reply wait and the rate, so a retry never fails late.
        var earlier = messages.findBySenderIdAndClientId(actor, clientId);
        if (earlier.isPresent()) return new Sent(view(sameRequest(earlier.get(), id, content), actor), false);
        ErrorCode block = sendBlock(c, remainingBeforeReply(c, actor));
        if (block != null) throw new CustomException(block);
        rateLimit(actor, RateKind.SEND);
        boolean inserted = messages.insert(id, actor, content, clientId) == 1;
        var m = sameRequest(messages.findBySenderIdAndClientId(actor, clientId).orElseThrow(), id, content);
        if (!inserted) return new Sent(view(m, actor), false);
        c.recordMessage(m);
        return new Sent(view(m, actor), true);
    }

    /** Moves the caller's read marker forward only, never past the last message. */
    @Transactional
    public Detail markRead(UUID actor, UUID id, long seq) {
        checkReader(access.lockActiveUser(actor));
        var c = participant(conversations.findByIdForUpdate(id), actor);
        c.markRead(actor, nextReadSeq(c.lastReadSeq(actor), seq, c.getLastMessageSeq()));
        return detail(c, actor);
    }

    // ------------------------------------------------------------------ rules (pure)

    /** Locked accounts and any account holding ADMIN or MODERATOR (even with other roles) stay out of messaging. */
    public static void checkReader(User user) {
        if (user == null || !user.isActive() || isStaff(user)) throw new CustomException(ErrorCode.ACCESS_DENIED);
    }

    /** Missing and not-mine look the same. */
    public static Conversation participant(Optional<Conversation> found, UUID actor) {
        return found.filter(c -> c.isParticipant(actor)).orElseThrow(() -> new CustomException(ErrorCode.CONVERSATION_NOT_FOUND));
    }

    /** The last message came from the other side after my read marker. */
    public static boolean unread(Conversation c, UUID me) {
        return c.getLastMessageSeq() != null && !me.equals(c.getLastMessageSenderId()) && c.getLastMessageSeq() > c.lastReadSeq(me);
    }

    /** Null for the author and once the author has replied; otherwise how many the learner may still send. */
    public static Integer remainingBeforeReply(boolean learner, boolean authorReplied, long learnerSent) {
        if (!learner || authorReplied) return null;
        return (int) Math.max(0, MESSAGES_BEFORE_REPLY - learnerSent);
    }

    /** Why sending is refused now, or null when it is allowed. */
    public static ErrorCode sendBlock(Conversation c, Integer remainingBeforeReply) {
        if (c.isBlocked()) return ErrorCode.CONVERSATION_BLOCKED;
        if (c.isLocked()) return ErrorCode.CONVERSATION_LOCKED;
        if (remainingBeforeReply != null && remainingBeforeReply == 0) return ErrorCode.CONVERSATION_AWAITING_REPLY;
        return null;
    }

    public static long nextReadSeq(long current, long requested, Long lastMessageSeq) {
        return Math.max(current, Math.min(requested, lastMessageSeq == null ? 0 : lastMessageSeq));
    }

    /** An earlier message with this client id counts as the same request only in the same conversation with the same content. */
    public static Message sameRequest(Message earlier, UUID conversation, String content) {
        if (!earlier.getConversationId().equals(conversation) || !earlier.getContent().equals(content))
            throw new CustomException(ErrorCode.MESSAGE_CLIENT_ID_CONFLICT);
        return earlier;
    }

    public static ContextCourse contextCourse(Conversation c, boolean available) {
        var course = c.getContextCourse();
        return new ContextCourse(course == null ? null : course.getId(), c.getContextCourseTitle(), course != null && available);
    }

    /** {@code rows} hold up to size + 1 messages, newest first when {@code newestFirst}; the result is ascending. */
    public static Messages page(List<Message> rows, int size, boolean newestFirst, UUID me) {
        var kept = new ArrayList<>(rows.subList(0, Math.min(size, rows.size())));
        if (newestFirst) Collections.reverse(kept);
        return new Messages(kept.stream().map(m -> view(m, me)).toList(), rows.size() > size);
    }

    public static String excerpt(String content) {
        return content.codePointCount(0, content.length()) <= EXCERPT_CODE_POINTS
                ? content
                : content.substring(0, content.offsetByCodePoints(0, EXCERPT_CODE_POINTS));
    }

    // ------------------------------------------------------------------ checks

    /** Article Markdown checks (raw HTML, unsafe links, NUL) plus no image node, all as MESSAGE_CONTENT_INVALID. */
    public void checkContent(String text) {
        try {
            markdown.validateContent(text);
        } catch (CustomException e) {
            throw new CustomException(ErrorCode.MESSAGE_CONTENT_INVALID);
        }
        if (!markdown.imageUrls(text).isEmpty()) throw new CustomException(ErrorCode.MESSAGE_CONTENT_INVALID);
    }

    public enum RateKind {
        SEND(20), OPEN(5);

        final int perMinute;

        RateKind(int perMinute) {
            this.perMinute = perMinute;
        }
    }

    /** Fixed one-minute window per user and kind; an unreachable Redis never lets a request through. */
    public void rateLimit(UUID actor, RateKind kind) {
        try {
            Long n = redis.execute(COUNTER, List.of("messaging:rate:" + kind.name().toLowerCase(Locale.ROOT) + ":" + actor));
            if (n == null) throw new CustomException(ErrorCode.MESSAGE_STORAGE_UNAVAILABLE);
            if (n > kind.perMinute) throw new CustomException(ErrorCode.MESSAGE_RATE_LIMITED);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.MESSAGE_STORAGE_UNAVAILABLE);
        }
    }

    // ------------------------------------------------------------------ helpers

    private void reader(UUID actor) {
        checkReader(users.findById(actor).orElse(null));
    }

    private static boolean isStaff(User user) {
        return user.getUserRoles().stream().anyMatch(l -> l.getRole().getName() == RoleName.ADMIN || l.getRole().getName() == RoleName.MODERATOR);
    }

    private Integer remainingBeforeReply(Conversation c, UUID me) {
        boolean learner = c.isLearner(me);
        if (!learner || c.isAuthorReplied()) return null;
        return remainingBeforeReply(true, false, messages.countByConversationIdAndSenderId(c.getId(), me));
    }

    private Detail detail(Conversation c, UUID me) {
        Integer remaining = remainingBeforeReply(c, me);
        return Detail.of(views(List.of(c), me).get(0), sendBlock(c, remaining) == null, remaining);
    }

    /** A fixed number of queries for the whole page: public courses, active enrollments, last messages. */
    private List<Summary> views(List<Conversation> page, UUID me) {
        if (page.isEmpty()) return List.of();
        Set<UUID> courseIds = page.stream().map(Conversation::getContextCourse).filter(Objects::nonNull).map(Course::getId).collect(Collectors.toSet());
        Set<UUID> available = new HashSet<>();
        Set<List<UUID>> enrolled = new HashSet<>();
        if (!courseIds.isEmpty()) {
            courses.findAll(CourseSpecification.visibleCourse().and((r, q, cb) -> r.get("id").in(courseIds))).forEach(x -> available.add(x.getId()));
            var learners = page.stream().map(c -> c.getLearner().getId()).collect(Collectors.toSet());
            for (Object[] row : conversations.findActiveEnrollments(courseIds, learners)) enrolled.add(List.of((UUID) row[0], (UUID) row[1]));
        }
        var lastSeqs = page.stream().map(Conversation::getLastMessageSeq).filter(Objects::nonNull).toList();
        Map<UUID, String> last = lastSeqs.isEmpty() ? Map.of()
                : messages.findLast(page.stream().map(Conversation::getId).toList(), lastSeqs).stream()
                        .collect(Collectors.toMap(Message::getConversationId, Message::getContent, (a, b) -> a));
        return page.stream().map(c -> {
            boolean learner = c.isLearner(me);
            var other = learner ? c.getAuthor() : c.getLearner();
            var course = contextCourse(c, c.getContextCourse() != null && available.contains(c.getContextCourse().getId()));
            Boolean isEnrolled = course.id() == null ? null : enrolled.contains(List.of(course.id(), c.getLearner().getId()));
            String text = last.get(c.getId());
            return new Summary(c.getId(), new ArticleAuthorResponse(other.getId(), other.getFullName(), other.getAvatarUrl()),
                    learner ? "LEARNER" : "AUTHOR", course, isEnrolled, text == null ? null : excerpt(text), c.getLastMessageAt(),
                    unread(c, me), c.isBlocked() && me.equals(c.getBlockedBy()), c.isBlocked() && !me.equals(c.getBlockedBy()), c.isLocked());
        }).toList();
    }

    private static ConversationResponse.Message view(Message m, UUID me) {
        return new ConversationResponse.Message(m.getId(), m.getSeq(), m.getSenderId(), m.getSenderId().equals(me), m.getContent(), m.getCreatedAt());
    }
}
