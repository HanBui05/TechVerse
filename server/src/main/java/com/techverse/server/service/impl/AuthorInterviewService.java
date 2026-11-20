package com.techverse.server.service.impl;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.TopicSpecification;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataAccessException;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Author side of interview questions. Lock order: users, author profile ({@link ArticleAccessService}),
 * the {@code interview_questions} row, then the topic.
 */
@Service
@RequiredArgsConstructor
public class AuthorInterviewService {
    static final int CREATES_PER_MINUTE = 20;
    private static final DefaultRedisScript<Long> COUNTER =
            new DefaultRedisScript<>(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
                    Long.class);

    private final ArticleAccessService access;
    private final ArticleContentService markdown;
    private final InterviewQuestionRepository questions;
    private final TopicRepository topics;
    private final StringRedisTemplate redis;
    private final EntityManager em;

    // ------------------------------------------------------------------ reads

    @Transactional
    public List<ArticleOptionResponse> options(UUID actor) {
        access.lockWriter(actor);
        return topics.findAll(TopicSpecification.hasActiveStatus(true), Sort.by("name", "id")).stream()
                .map(t -> new ArticleOptionResponse(t.getId(), t.getName(), t.isActive()))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<InterviewQuestionResponse> list(UUID actor, InterviewQuestionRequest.Filter f) {
        access.checkReader(actor);
        Specification<InterviewQuestion> spec = (root, q, cb) -> cb.equal(root.get("author").get("id"), actor);
        if (f.getStatus() != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), f.getStatus()));
        if (f.getLevel() != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("level"), f.getLevel()));
        if (f.getTopicId() != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("topic").get("id"), f.getTopicId()));
        if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
            String like = "%" + f.getKeyword().strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((root, q, cb) -> cb.like(cb.lower(root.get("question")), like, '\\'));
        }
        var page = questions.findAll(spec, PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
        return PageResponse.from(page, page.stream().map(InterviewQuestionResponse::of).toList());
    }

    @Transactional(readOnly = true)
    public InterviewQuestionResponse detail(UUID actor, UUID id) {
        access.checkReader(actor);
        var q = questions.findById(id).filter(x -> x.getAuthor().getId().equals(actor))
                .orElseThrow(() -> new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        return InterviewQuestionResponse.of(q);
    }

    // ------------------------------------------------------------------ writes

    @Transactional
    public InterviewQuestionResponse create(UUID actor, InterviewQuestionRequest.Create r) {
        var user = access.lockWriter(actor);
        rateLimit(actor);
        checkContent(r.question(), r.sampleAnswer(), r.hint());
        var topic = activeTopic(UUID.fromString(r.topicId()));
        var q = questions.save(InterviewQuestion.create(user, topic, InterviewLevel.valueOf(r.level()), r.question(), r.sampleAnswer(), r.hint()));
        return flushed(q);
    }

    @Transactional
    public InterviewQuestionResponse update(UUID actor, UUID id, InterviewQuestionRequest.Update r) {
        access.lockWriter(actor);
        var q = lockOwned(actor, id);
        q.ensureEditable();
        q.ensureVersion(r.version().intValueExact());
        checkContent(r.question(), r.sampleAnswer(), r.hint());
        // The kept topic must be active too ("active when saving").
        var topic = activeTopic(r.topicId() == null ? q.getTopic().getId() : UUID.fromString(r.topicId()));
        q.edit(topic, r.level() == null ? null : InterviewLevel.valueOf(r.level()), r.question(), r.sampleAnswer(), r.hint());
        return flushed(q);
    }

    @Transactional
    public InterviewQuestionResponse submit(UUID actor, UUID id) {
        access.lockWriter(actor);
        var q = lockOwned(actor, id);
        // State first, then the topic (documented lock order).
        q.submit();
        lockActiveTopic(q.getTopic().getId());
        return flushed(q);
    }

    @Transactional
    public InterviewQuestionResponse withdraw(UUID actor, UUID id) {
        lockAuthorAccount(actor);
        var q = lockOwned(actor, id);
        q.withdraw();
        return flushed(q);
    }

    @Transactional
    public InterviewQuestionResponse visibility(UUID actor, UUID id, InterviewQuestionRequest.Visibility r) {
        boolean hide = "HIDE".equals(r.action());
        // Suspended Authors may still hide their own questions, but not bring them back.
        if (hide) lockAuthorAccount(actor);
        else access.lockWriter(actor);
        var q = lockOwned(actor, id);
        if (hide) q.authorHide();
        else q.authorUnhide();
        return flushed(q);
    }

    @Transactional
    public InterviewQuestionResponse copy(UUID actor, UUID id) {
        access.lockWriter(actor);
        var src = lockOwned(actor, id);
        rateLimit(actor);
        lockActiveTopic(src.getTopic().getId());
        return flushed(questions.save(src.copy()));
    }

    @Transactional
    public void delete(UUID actor, UUID id) {
        lockAuthorAccount(actor);
        var q = lockOwned(actor, id);
        q.ensureDeletable();
        questions.delete(q);
        questions.flush();
    }

    // ------------------------------------------------------------------ AI drafts (1c)

    /** Plain copy of what the model may see; no entity crosses the provider call. */
    public record AiContext(String topic, List<String> existing) {}

    /** One generated question; also the model's output item shape. */
    public record AiDraft(String question, String sampleAnswer, String hint) {}

    static final int AI_EXISTING = 20;

    /** Author eligibility, the active topic and the Author's 20 newest questions in it (to avoid duplicates). */
    @Transactional
    public AiContext aiContext(UUID actor, UUID topicId) {
        access.lockWriter(actor);
        var topic = activeTopic(topicId);
        Specification<InterviewQuestion> mine = (root, q, cb) ->
                cb.and(cb.equal(root.get("author").get("id"), actor), cb.equal(root.get("topic").get("id"), topicId));
        var existing = questions.findAll(mine, PageRequest.of(0, AI_EXISTING, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))))
                .map(InterviewQuestion::getQuestion).toList();
        return new AiContext(topic.getName(), existing);
    }

    /** The cleaned draft when it passes the same checks as {@code create}, else null. */
    public AiDraft aiUsable(AiDraft d) {
        if (d == null || d.question() == null || d.sampleAnswer() == null) return null;
        String question = d.question().strip(), answer = d.sampleAnswer().strip();
        String hint = d.hint() == null || d.hint().isBlank() ? null : d.hint().strip();
        if (question.length() < 10 || question.length() > 1000 || answer.length() < 20 || answer.length() > 5000
                || (hint != null && hint.length() > 500)) return null;
        try {
            checkContent(question, answer, hint);
        } catch (CustomException e) {
            return null;
        }
        return new AiDraft(question, answer, hint);
    }

    /** After the model answered: re-check the Author and the topic, then save every draft in this one transaction. */
    @Transactional
    public List<InterviewQuestionResponse> saveAiDrafts(UUID actor, UUID topicId, InterviewLevel level, List<AiDraft> drafts) {
        var user = access.lockWriter(actor);
        var topic = activeTopic(topicId);
        var saved = drafts.stream().map(d -> {
            var q = InterviewQuestion.create(user, topic, level, d.question(), d.sampleAnswer(), d.hint());
            q.markAiAssisted();
            return questions.save(q);
        }).toList();
        questions.flush();
        return saved.stream().map(InterviewQuestionResponse::of).toList();
    }

    /** Markdown rules for every content field: article checks (raw HTML, unsafe links, NUL) and no image node. */
    public void checkContent(String... texts) {
        for (String text : texts) {
            if (text == null || text.isEmpty()) continue;
            try {
                markdown.validateContent(text);
            } catch (CustomException e) {
                throw new CustomException(ErrorCode.INTERVIEW_CONTENT_INVALID);
            }
            if (!markdown.imageUrls(text).isEmpty()) throw new CustomException(ErrorCode.INTERVIEW_CONTENT_INVALID);
        }
    }

    // ------------------------------------------------------------------ helpers

    /** Active account with an author profile in any status: what a suspended Author keeps. */
    private void lockAuthorAccount(UUID actor) {
        access.lockActiveUser(actor);
        access.checkReader(actor);
    }

    private InterviewQuestion lockOwned(UUID actor, UUID id) {
        var q = questions.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        // OSIV keeps entities across transactions; make sure the locked row is read fresh.
        em.refresh(q);
        if (!q.getAuthor().getId().equals(actor)) throw new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND);
        return q;
    }

    /** Unknown topic is a field error (create/update input). */
    private Topic activeTopic(UUID id) {
        var topic = topics.findByIdForUpdate(id)
                .orElseThrow(() -> new CustomException(ErrorCode.VALIDATION_ERROR, Map.of("topicId", "Topic not found")));
        // OSIV: the AI flow loaded this topic in an earlier transaction; read the locked row fresh.
        em.refresh(topic);
        if (!topic.isActive()) throw new CustomException(ErrorCode.INTERVIEW_TOPIC_INACTIVE);
        return topic;
    }

    private void lockActiveTopic(UUID id) {
        if (!topics.findByIdForUpdate(id).orElseThrow().isActive()) throw new CustomException(ErrorCode.INTERVIEW_TOPIC_INACTIVE);
    }

    /** Creates and copies share one fixed one-minute window; an unreachable Redis never lets a request through. */
    private void rateLimit(UUID actor) {
        try {
            Long n = redis.execute(COUNTER, List.of("interview:rate:create:" + actor));
            if (n == null) throw new CustomException(ErrorCode.INTERVIEW_STORAGE_UNAVAILABLE);
            if (n > CREATES_PER_MINUTE) throw new CustomException(ErrorCode.INTERVIEW_RATE_LIMITED);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.INTERVIEW_STORAGE_UNAVAILABLE);
        }
    }

    private InterviewQuestionResponse flushed(InterviewQuestion q) {
        questions.flush();
        return InterviewQuestionResponse.of(q);
    }
}
