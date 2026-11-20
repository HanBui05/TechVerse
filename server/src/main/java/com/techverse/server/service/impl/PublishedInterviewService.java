package com.techverse.server.service.impl;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.InterviewQuestionResponse.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.TopicSpecification;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Learner side: public question pages, the sample answer behind login, and "reviewed"/"saved" marks. */
@Service
@RequiredArgsConstructor
public class PublishedInterviewService {
    private final InterviewQuestionRepository questions;
    private final InterviewQuestionMarkRepository marks;
    private final UserRepository users;
    private final TopicRepository topics;

    @Transactional(readOnly = true)
    public PageResponse<Published> list(UUID actor, InterviewQuestionRequest.PublicFilter f) {
        if (actor == null && f.getMark() != null) throw new CustomException(ErrorCode.ACCESS_TOKEN_REQUIRED);
        reader(actor);
        Specification<InterviewQuestion> spec = visible();
        if (f.getTopicId() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("topic").get("id"), f.getTopicId()));
        if (f.getLevel() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("level"), f.getLevel()));
        if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
            String like = "%" + f.getKeyword().strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((r, q, cb) -> cb.like(cb.lower(r.get("question")), like, '\\'));
        }
        if (f.getMark() != null) {
            String stamp = f.getMark() == InterviewQuestionRequest.MarkFilter.SAVED ? "savedAt" : "reviewedAt";
            spec = spec.and((r, q, cb) -> {
                var sub = q.subquery(UUID.class);
                var m = sub.from(InterviewQuestionMark.class);
                sub.select(m.get("id")).where(cb.equal(m.get("question"), r), cb.equal(m.get("user").get("id"), actor), cb.isNotNull(m.get(stamp)));
                return cb.exists(sub);
            });
        }
        var page = questions.findAll(spec, PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.DESC, "publishedAt").and(Sort.by("id"))));
        var viewers = viewers(actor, page.stream().map(InterviewQuestion::getId).toList());
        return PageResponse.from(page, page.stream().map(q -> view(q, viewers.get(q.getId()))).toList());
    }

    @Transactional(readOnly = true)
    public List<ArticleOptionResponse> options() {
        return topics.findAll(TopicSpecification.hasActiveStatus(true), Sort.by("name", "id")).stream()
                .map(t -> new ArticleOptionResponse(t.getId(), t.getName(), t.isActive())).toList();
    }

    @Transactional(readOnly = true)
    public Published detail(UUID actor, UUID id) {
        reader(actor);
        var q = visibleQuestion(id);
        return view(q, viewers(actor, List.of(id)).get(id));
    }

    @Transactional(readOnly = true)
    public Answer answer(UUID actor, UUID id) {
        reader(actor);
        var q = visibleQuestion(id);
        return new Answer(q.getHint(), q.getSampleAnswer());
    }

    @Transactional
    public Viewer mark(UUID actor, UUID id, InterviewQuestionRequest.Mark r) {
        reader(actor);
        visibleQuestion(id);
        marks.upsert(actor, id, r.reviewed() != null, Boolean.TRUE.equals(r.reviewed()), r.saved() != null, Boolean.TRUE.equals(r.saved()));
        return viewers(actor, List.of(id)).get(id);
    }

    /** What the feedback model sees; the sample answer goes to the model only, never back to the learner. */
    public record FeedbackContext(String topic, InterviewLevel level, String question, String sampleAnswer) {}

    @Transactional(readOnly = true)
    public FeedbackContext feedbackContext(UUID actor, UUID id) {
        reader(actor);
        var q = visibleQuestion(id);
        return new FeedbackContext(q.getTopic().getName(), q.getLevel(), q.getQuestion(), q.getSampleAnswer());
    }

    // ------------------------------------------------------------------ helpers

    /** Published, author active and not suspended (same rule as articles, courses and exercise sets). */
    private static Specification<InterviewQuestion> visible() {
        return (root, q, cb) -> {
            var suspended = q.subquery(UUID.class);
            var profile = suspended.from(AuthorProfile.class);
            suspended.select(profile.get("id")).where(cb.equal(profile.get("user"), root.get("author")),
                    cb.equal(profile.get("status"), AuthorProfileStatus.SUSPENDED));
            return cb.and(cb.equal(root.get("status"), InterviewStatus.PUBLISHED), cb.isTrue(root.get("author").get("active")),
                    cb.not(cb.exists(suspended)));
        };
    }

    private InterviewQuestion visibleQuestion(UUID id) {
        return questions.findOne(visible().and((r, q, cb) -> cb.equal(r.get("id"), id)))
                .orElseThrow(() -> new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
    }

    /** Guests pass; a locked account is rejected on every route it calls with its token. */
    @Transactional(readOnly = true)
    public void reader(UUID actor) {
        if (actor == null) return;
        var user = users.findById(actor).orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        if (!user.isActive()) throw new CustomException(ErrorCode.ACCESS_DENIED);
    }

    /** Signed-in viewers get a stamp pair for every id (unmarked = both false); guests get an empty map. */
    private Map<UUID, Viewer> viewers(UUID actor, List<UUID> ids) {
        if (actor == null || ids.isEmpty()) return Map.of();
        var found = marks.findFor(actor, ids).stream().collect(Collectors.toMap(m -> m.getQuestion().getId(), Function.identity()));
        var out = new HashMap<UUID, Viewer>();
        for (UUID id : ids) {
            var m = found.get(id);
            out.put(id, m == null ? new Viewer(false, false) : new Viewer(m.getReviewedAt() != null, m.getSavedAt() != null));
        }
        return out;
    }

    private static Published view(InterviewQuestion q, Viewer viewer) {
        var t = q.getTopic();
        var a = q.getAuthor();
        return new Published(q.getId(), new ArticleOptionResponse(t.getId(), t.getName(), t.isActive()), q.getLevel(), q.getQuestion(),
                new ArticleAuthorResponse(a.getId(), a.getFullName(), a.getAvatarUrl()), q.getPublishedAt(), q.getHint() != null, viewer);
    }
}
