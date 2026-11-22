package com.techverse.server.service.impl;

import static com.techverse.server.enums.ForumPostStatus.*;

import com.techverse.server.dto.request.ForumRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ForumResponse.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.ForumReactionType;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.TopicSpecification;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Forum Q&A. Lock order on every write: the actor ({@link ArticleAccessService#lockActiveUser}), the topic
 * (when one is set or changed), the question, then the answer. A HIDDEN post, an answer under a HIDDEN
 * question and a DELETED question with no visible answer do not exist for anyone outside moderation.
 */
@Service
@RequiredArgsConstructor
public class ForumService {
    static final int MAX_ANSWERS = 200;
    static final int EXCERPT_CODE_POINTS = 200;
    static final long DUPLICATE_WINDOW_SECONDS = 60;
    private static final DefaultRedisScript<Long> COUNTER =
            new DefaultRedisScript<>(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
                    Long.class);

    private final ArticleAccessService access;
    private final ArticleContentService markdown;
    private final ForumPostRepository posts;
    private final TopicRepository topics;
    private final UserRepository users;
    private final ReportRepository reports;
    private final ForumPostReactionRepository reactions;
    private final StringRedisTemplate redis;

    // ------------------------------------------------------------------ reads

    @Transactional(readOnly = true)
    public PageResponse<Summary> list(UUID actor, ForumRequest.Filter f) {
        if (f.isMine()) {
            if (actor == null) throw new CustomException(ErrorCode.ACCESS_TOKEN_REQUIRED);
            if (viewer(actor) == null) throw new CustomException(ErrorCode.ACCESS_DENIED);
        }
        Specification<ForumPost> spec = (r, q, cb) -> cb.and(cb.isNull(r.get("parent")), cb.equal(r.get("status"), VISIBLE));
        if (f.getTopicId() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("topic").get("id"), f.getTopicId()));
        if (f.isMine()) spec = spec.and((r, q, cb) -> cb.equal(r.get("user").get("id"), actor));
        if (f.getSolved() != null) {
            boolean solved = f.getSolved();
            spec = spec.and((r, q, cb) -> {
                var sub = q.subquery(UUID.class);
                var a = sub.from(ForumPost.class);
                sub.select(a.get("id")).where(cb.equal(a, r.get("acceptedAnswer")), cb.equal(a.get("status"), VISIBLE));
                return solved ? cb.exists(sub) : cb.not(cb.exists(sub));
            });
        }
        if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
            String like = "%" + f.getKeyword().strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((r, q, cb) -> cb.or(cb.like(cb.lower(r.get("title")), like, '\\'), cb.like(cb.lower(r.get("content")), like, '\\')));
        }
        var page = posts.findAll(spec, PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
        var counts = new HashMap<UUID, Long>();
        var reacted = new HashMap<UUID, Long>();
        if (page.hasContent()) {
            var ids = page.stream().map(ForumPost::getId).toList();
            for (Object[] row : posts.countAnswers(ids, VISIBLE)) counts.put((UUID) row[0], (Long) row[1]);
            for (Object[] row : reactions.countTotal(ids)) reacted.put((UUID) row[0], (Long) row[1]);
        }
        return PageResponse.from(page, page.stream().map(p -> new Summary(p.getId(), p.getTitle(), excerpt(p.getContent()), topic(p.getTopic()),
                author(p.getUser()), counts.getOrDefault(p.getId(), 0L), reacted.getOrDefault(p.getId(), 0L), solved(p), p.getCreatedAt(),
                p.getEditedAt())).toList());
    }

    @Transactional(readOnly = true)
    public List<ArticleOptionResponse> options() {
        return topics.findAll(TopicSpecification.hasActiveStatus(true), Sort.by("name", "id")).stream().map(ForumService::topic).toList();
    }

    @Transactional(readOnly = true)
    public Question detail(UUID actor, UUID id) {
        var q = posts.findById(id).filter(ForumPost::isQuestion).orElseThrow(ForumService::notFound);
        var answers = posts.findAnswers(id, VISIBLE);
        if (!questionReadable(q, !answers.isEmpty())) throw notFound();
        return view(q, answers, viewer(actor));
    }

    // ------------------------------------------------------------------ questions

    @Transactional
    public Question createQuestion(UUID actor, ForumRequest.CreateQuestion r) {
        checkContent(r.content());
        var user = access.lockActiveUser(actor);
        var topic = lockTopic(r.topicId());
        if (!topic.isActive()) throw new CustomException(ErrorCode.FORUM_TOPIC_INACTIVE);
        if (posts.existsRecentQuestion(actor, r.title(), r.content(), VISIBLE, recent())) throw new CustomException(ErrorCode.FORUM_DUPLICATE_POST);
        rateLimit(actor, RateKind.QUESTION);
        var q = posts.save(ForumPost.question(user, topic, r.title(), r.content()));
        return view(q, List.of(), actor);
    }

    @Transactional
    public Question updateQuestion(UUID actor, UUID id, ForumRequest.UpdateQuestion r) {
        if (r.getContent() != null) checkContent(r.getContent());
        access.lockActiveUser(actor);
        var topic = r.getTopicId() == null ? null : lockTopic(r.getTopicId());
        var q = lockQuestion(id);
        if (!q.isOwnedBy(actor)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        if (q.getStatus() == DELETED) throw new CustomException(ErrorCode.FORUM_QUESTION_CLOSED);
        // Keeping a topic that has since been deactivated is allowed; switching to an inactive one is not.
        if (topic != null && !topic.getId().equals(q.getTopic().getId()) && !topic.isActive())
            throw new CustomException(ErrorCode.FORUM_TOPIC_INACTIVE);
        q.edit(topic, r.getTitle(), r.getContent());
        posts.flush();
        return view(q, posts.findAnswers(id, VISIBLE), actor);
    }

    @Transactional
    public void deleteQuestion(UUID actor, UUID id) {
        access.lockActiveUser(actor);
        var q = lockQuestion(id);
        if (!q.isOwnedBy(actor)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        if (q.getStatus() == DELETED) throw notFound();
        q.delete();
        dismissReports(id);
    }

    @Transactional
    public Question accept(UUID actor, UUID id, UUID answerId) {
        access.lockActiveUser(actor);
        var q = lockQuestion(id);
        if (!q.isOwnedBy(actor)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        if (q.getStatus() == DELETED) throw new CustomException(ErrorCode.FORUM_QUESTION_CLOSED);
        ForumPost answer = null;
        if (answerId != null) {
            // Check the parent without a lock first: locking an unrelated post here would break the lock order.
            if (!posts.findParentIdById(answerId).map(id::equals).orElse(false)) throw new CustomException(ErrorCode.FORUM_ANSWER_INVALID);
            answer = posts.findByIdForUpdate(answerId)
                    .filter(a -> !a.isQuestion() && a.getParent().getId().equals(id) && a.getStatus() == VISIBLE)
                    .orElseThrow(() -> new CustomException(ErrorCode.FORUM_ANSWER_INVALID));
        }
        q.accept(answer);
        posts.flush();
        return view(q, posts.findAnswers(id, VISIBLE), actor);
    }

    // ------------------------------------------------------------------ answers

    @Transactional
    public ForumResponse.Answer createAnswer(UUID actor, UUID questionId, ForumRequest.Answer r) {
        checkContent(r.content());
        var user = access.lockActiveUser(actor);
        var q = lockQuestion(questionId);
        if (q.getStatus() == DELETED) throw new CustomException(ErrorCode.FORUM_QUESTION_CLOSED);
        if (posts.existsRecentAnswer(actor, questionId, r.content(), VISIBLE, recent())) throw new CustomException(ErrorCode.FORUM_DUPLICATE_POST);
        if (posts.countAnswers(questionId, VISIBLE) >= MAX_ANSWERS) throw new CustomException(ErrorCode.FORUM_ANSWER_LIMIT);
        rateLimit(actor, RateKind.ANSWER);
        var a = posts.save(ForumPost.answer(user, q, r.content()));
        return view(a, q, actor, false, reactionsOf(List.of(a.getId()), actor).get(a.getId()));
    }

    @Transactional
    public ForumResponse.Answer updateAnswer(UUID actor, UUID id, ForumRequest.Answer r) {
        checkContent(r.content());
        access.lockActiveUser(actor);
        var a = lockAnswer(id);
        if (!a.isOwnedBy(actor)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        a.edit(null, null, r.content());
        posts.flush();
        return view(a, a.getParent(), actor, false, reactionsOf(List.of(id), actor).get(id));
    }

    @Transactional
    public void deleteAnswer(UUID actor, UUID id) {
        access.lockActiveUser(actor);
        var a = lockAnswer(id);
        if (!a.isOwnedBy(actor)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        a.delete();
        dismissReports(id);
    }

    // ------------------------------------------------------------------ reactions

    /** Lock order: the actor (serializes one user's reactions), the question, then the answer; rate checked last. */
    @Transactional
    public Reactions react(UUID actor, UUID id, ForumReactionType type) {
        access.lockActiveUser(actor);
        lockReactable(id);
        rateLimit(actor, RateKind.REACT);
        reactions.upsert(actor, id, type.name());
        return reactionsOf(List.of(id), actor).get(id);
    }

    @Transactional
    public Reactions unreact(UUID actor, UUID id) {
        access.lockActiveUser(actor);
        lockReactable(id);
        rateLimit(actor, RateKind.REACT);
        reactions.remove(actor, id);
        return reactionsOf(List.of(id), actor).get(id);
    }

    @Transactional(readOnly = true)
    public PageResponse<Reactor> reactions(UUID id, ForumReactionType type, int page, int size) {
        var p = posts.findById(id).orElseThrow(ForumService::notFound);
        if (p.isQuestion()) {
            boolean deleted = p.getStatus() == DELETED;
            if (!questionReadable(p, deleted && posts.countAnswers(id, VISIBLE) > 0)) throw notFound();
            if (deleted) throw new CustomException(ErrorCode.FORUM_QUESTION_CLOSED);
        } else if (!answerReadable(p)) throw notFound();
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt", "id"));
        var rows = type == null ? reactions.findByPostId(id, pageable) : reactions.findByPostIdAndType(id, type, pageable);
        return PageResponse.from(rows, rows.stream().map(r -> new Reactor(author(r.getUser()), r.getType(), r.getUpdatedAt())).toList());
    }

    // ------------------------------------------------------------------ rules (pure)

    public static boolean questionReadable(ForumPost q, boolean hasVisibleAnswers) {
        return q.getStatus() == VISIBLE || (q.getStatus() == DELETED && hasVisibleAnswers);
    }

    /** An answer exists for readers while it is VISIBLE and its question is not HIDDEN. */
    public static boolean answerReadable(ForumPost a) {
        return a.getStatus() == VISIBLE && a.getParent().getStatus() != HIDDEN;
    }

    public static boolean solved(ForumPost q) {
        return q.getAcceptedAnswer() != null && q.getAcceptedAnswer().getStatus() == VISIBLE;
    }

    /** {@code viewer} is null for guests and locked accounts. Assumes the question is readable. */
    public static QuestionViewer questionViewer(ForumPost q, UUID viewer, boolean reported) {
        boolean open = q.getStatus() == VISIBLE;
        boolean own = q.isOwnedBy(viewer);
        return new QuestionViewer(own && open, own && open, viewer != null && !own && open && !reported, own && open, viewer != null && open,
                viewer != null && open);
    }

    /** Assumes the answer is readable. */
    public static PostViewer answerViewer(ForumPost a, UUID viewer, boolean reported) {
        boolean own = a.isOwnedBy(viewer);
        return new PostViewer(own, own, viewer != null && !own && !reported, viewer != null);
    }

    // ------------------------------------------------------------------ checks

    /** Article Markdown checks (raw HTML, unsafe links, NUL) plus no image node, all as FORUM_CONTENT_INVALID. */
    public void checkContent(String text) {
        try {
            markdown.validateContent(text);
        } catch (CustomException e) {
            throw new CustomException(ErrorCode.FORUM_CONTENT_INVALID);
        }
        if (!markdown.imageUrls(text).isEmpty()) throw new CustomException(ErrorCode.FORUM_CONTENT_INVALID);
    }

    public enum RateKind {
        QUESTION(3), ANSWER(10), REPORT(10), REACT(30);

        final int perMinute;

        RateKind(int perMinute) {
            this.perMinute = perMinute;
        }
    }

    /** Fixed one-minute window per user and kind; an unreachable Redis never lets a request through. */
    public void rateLimit(UUID actor, RateKind kind) {
        try {
            Long n = redis.execute(COUNTER, List.of("forum:rate:" + kind.name().toLowerCase(Locale.ROOT) + ":" + actor));
            if (n == null) throw new CustomException(ErrorCode.FORUM_STORAGE_UNAVAILABLE);
            if (n > kind.perMinute) throw new CustomException(ErrorCode.FORUM_RATE_LIMITED);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.FORUM_STORAGE_UNAVAILABLE);
        }
    }

    // ------------------------------------------------------------------ helpers

    /** Locks a question that readers can still see (VISIBLE, or DELETED with a visible answer). */
    private ForumPost lockQuestion(UUID id) {
        var q = posts.findByIdForUpdate(id).filter(ForumPost::isQuestion).orElseThrow(ForumService::notFound);
        if (!questionReadable(q, q.getStatus() == DELETED && posts.countAnswers(id, VISIBLE) > 0)) throw notFound();
        return q;
    }

    /** Reads the parent without a lock, locks question then answer, and re-checks both after locking. */
    private ForumPost lockAnswer(UUID id) {
        UUID parent = posts.findParentIdById(id).orElseThrow(ForumService::notFound);
        var q = posts.findByIdForUpdate(parent).orElseThrow(ForumService::notFound);
        var a = posts.findByIdForUpdate(id).orElseThrow(ForumService::notFound);
        if (a.getParent() == null || !a.getParent().getId().equals(q.getId()) || !answerReadable(a)) throw notFound();
        return a;
    }

    /** Locks a post that takes reactions: 404 when readers cannot see it, 409 on a deleted question still shown. */
    private void lockReactable(UUID id) {
        if (posts.findParentIdById(id).isPresent()) lockAnswer(id);
        else if (lockQuestion(id).getStatus() == DELETED) throw new CustomException(ErrorCode.FORUM_QUESTION_CLOSED);
    }

    /** Two grouped queries for the whole set: counts per (post, type) and the viewer's own type. */
    private Map<UUID, Reactions> reactionsOf(List<UUID> ids, UUID viewer) {
        var counts = new HashMap<UUID, Map<ForumReactionType, Long>>();
        for (UUID id : ids) {
            var m = new EnumMap<ForumReactionType, Long>(ForumReactionType.class);
            for (var t : ForumReactionType.values()) m.put(t, 0L);
            counts.put(id, m);
        }
        for (Object[] row : reactions.countByType(ids)) counts.get((UUID) row[0]).put((ForumReactionType) row[1], (Long) row[2]);
        var mine = new HashMap<UUID, ForumReactionType>();
        if (viewer != null) for (Object[] row : reactions.findMine(viewer, ids)) mine.put((UUID) row[0], (ForumReactionType) row[1]);
        var out = new HashMap<UUID, Reactions>();
        for (UUID id : ids) out.put(id, new Reactions(counts.get(id), mine.get(id)));
        return out;
    }

    private Topic lockTopic(String id) {
        return topics.findByIdForUpdate(UUID.fromString(id))
                .orElseThrow(() -> new CustomException(ErrorCode.VALIDATION_ERROR, Map.of("topicId", "Topic not found")));
    }

    /** The actor when signed in and active; null for guests and locked or unknown accounts. */
    private UUID viewer(UUID actor) {
        if (actor == null) return null;
        return users.findById(actor).filter(User::isActive).map(User::getId).orElse(null);
    }

    /** The post's lock is held here, so its open reports cannot change under us. */
    private void dismissReports(UUID postId) {
        reports.dismissOpen(Report.FORUM_POST, postId, "Người đăng đã xóa nội dung", Instant.now());
    }

    private static Instant recent() {
        return Instant.now().minusSeconds(DUPLICATE_WINDOW_SECONDS);
    }

    private static CustomException notFound() {
        return new CustomException(ErrorCode.FORUM_POST_NOT_FOUND);
    }

    private Question view(ForumPost q, List<ForumPost> visibleAnswers, UUID viewer) {
        var ids = new ArrayList<UUID>(List.of(q.getId()));
        visibleAnswers.forEach(a -> ids.add(a.getId()));
        Set<UUID> reported = viewer == null ? Set.of() : reports.findReportedTargets(viewer, Report.FORUM_POST, ids);
        var reacted = reactionsOf(ids, viewer);
        var answers = new ArrayList<ForumResponse.Answer>();
        for (var a : visibleAnswers) answers.add(view(a, q, viewer, reported.contains(a.getId()), reacted.get(a.getId())));
        // The accepted answer leads; the rest stay oldest first.
        answers.sort(Comparator.comparing(a -> !a.accepted()));
        boolean deleted = q.getStatus() == DELETED;
        return new Question(q.getId(), deleted ? null : q.getTitle(), deleted ? null : q.getContent(), topic(q.getTopic()),
                deleted ? null : author(q.getUser()), deleted, solved(q), solved(q) ? q.getAcceptedAnswer().getId() : null,
                answers.size(), q.getCreatedAt(), q.getEditedAt(), questionViewer(q, viewer, reported.contains(q.getId())),
                deleted ? null : reacted.get(q.getId()), answers);
    }

    private static ForumResponse.Answer view(ForumPost a, ForumPost q, UUID viewer, boolean reported, Reactions reactions) {
        return new ForumResponse.Answer(a.getId(), a.getContent(), author(a.getUser()), q.isAccepted(a), a.getCreatedAt(), a.getEditedAt(),
                answerViewer(a, viewer, reported), reactions);
    }

    private static ArticleOptionResponse topic(Topic t) {
        return new ArticleOptionResponse(t.getId(), t.getName(), t.isActive());
    }

    private static ArticleAuthorResponse author(User u) {
        return new ArticleAuthorResponse(u.getId(), u.getFullName(), u.getAvatarUrl());
    }

    private static String excerpt(String content) {
        return content.codePointCount(0, content.length()) <= EXCERPT_CODE_POINTS
                ? content
                : content.substring(0, content.offsetByCodePoints(0, EXCERPT_CODE_POINTS));
    }
}
