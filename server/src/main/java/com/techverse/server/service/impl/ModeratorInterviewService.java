package com.techverse.server.service.impl;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.InterviewQuestionResponse.Moderated;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Moderator review and publication of interview questions. Lock order: users, author profile, the
 * question row, then the topic. The review token is derived from {@code version}, which every change bumps.
 */
@Service
@RequiredArgsConstructor
public class ModeratorInterviewService {
    private final InterviewQuestionRepository questions;
    private final UserRepository users;
    private final AuthorProfileRepository profiles;
    private final ArticleRepository articles;
    private final TopicRepository topics;
    private final EntityManager em;

    @Transactional(readOnly = true)
    public PageResponse<Moderated> list(UUID actor, InterviewQuestionRequest.Filter f) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        // Drafts (including withdrawn ones) are private to the author; default view is the review queue.
        var status = f.getStatus() == null ? InterviewStatus.PENDING : f.getStatus();
        Specification<InterviewQuestion> spec = (r, q, cb) -> cb.and(cb.notEqual(r.get("status"), InterviewStatus.DRAFT), cb.equal(r.get("status"), status));
        if (f.getLevel() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("level"), f.getLevel()));
        if (f.getTopicId() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("topic").get("id"), f.getTopicId()));
        if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
            String like = "%" + f.getKeyword().strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((r, q, cb) -> cb.like(cb.lower(r.get("question")), like, '\\'));
        }
        var page = questions.findAll(spec, PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.ASC, "updatedAt").and(Sort.by("id"))));
        Set<UUID> eligible = page.isEmpty() ? Set.of()
                : articles.findEligibleAuthorIds(page.stream().map(x -> x.getAuthor().getId()).distinct().toList());
        return PageResponse.from(page, page.stream().map(x -> view(x, eligible.contains(x.getAuthor().getId()))).toList());
    }

    @Transactional(readOnly = true)
    public Moderated detail(UUID actor, UUID id) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        var q = questions.findById(id).filter(x -> x.getStatus() != InterviewStatus.DRAFT)
                .orElseThrow(() -> new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        return detailView(q);
    }

    @Transactional
    public Moderated review(UUID actor, UUID id, InterviewQuestionRequest.Review r) {
        boolean approve = "APPROVE".equals(r.decision());
        String note = note(r.note(), !approve, "note");
        UUID authorId = questions.findAuthorIdById(id).orElseThrow(() -> new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        var locked = users.findAllByIdForAdminStatusUpdate(List.of(actor, authorId)).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        locked.values().forEach(em::refresh);
        User moderator = locked.get(actor);
        checkModerator(moderator);
        var profile = profiles.findByUserIdForResubmit(authorId).orElse(null);
        if (profile != null) em.refresh(profile);
        var q = lockedQuestion(id);
        if (!token(q).equals(r.reviewToken())) throw new CustomException(ErrorCode.INTERVIEW_REVIEW_STALE);
        if (q.getStatus() != InterviewStatus.PENDING) throw new CustomException(ErrorCode.INTERVIEW_STATE_INVALID);
        if (approve) {
            User author = locked.get(authorId);
            if (author == null || !author.isActive()
                    || author.getUserRoles().stream().noneMatch(l -> l.getRole().getName() == RoleName.AUTHOR)
                    || profile == null || profile.getStatus() != AuthorProfileStatus.APPROVED)
                throw new CustomException(ErrorCode.INTERVIEW_AUTHOR_INELIGIBLE);
            var topic = topics.findByIdForUpdate(q.getTopic().getId()).orElseThrow(() -> new CustomException(ErrorCode.INTERVIEW_TOPIC_INACTIVE));
            em.refresh(topic);
            if (!topic.isActive()) throw new CustomException(ErrorCode.INTERVIEW_TOPIC_INACTIVE);
            q.approve(moderator, note);
        } else {
            q.requestChanges(moderator, note);
        }
        questions.flush();
        return detailView(q);
    }

    @Transactional
    public Moderated publication(UUID actor, UUID id, InterviewQuestionRequest.Publication r) {
        String note = note(r.reason(), !"RESTORE".equals(r.action()), "reason");
        User moderator = users.findAllByIdForAdminStatusUpdate(List.of(actor)).stream().findFirst().orElse(null);
        if (moderator != null) em.refresh(moderator);
        checkModerator(moderator);
        var q = lockedQuestion(id);
        if (!token(q).equals(r.reviewToken())) throw new CustomException(ErrorCode.INTERVIEW_REVIEW_STALE);
        switch (r.action()) {
            case "HIDE" -> q.moderatorHide(moderator, note);
            case "RESTORE" -> q.moderatorRestore(moderator, note);
            default -> q.remove(moderator, note);
        }
        questions.flush();
        return detailView(q);
    }

    // ------------------------------------------------------------------ helpers

    /** A never-submitted draft is private to its author, so it does not exist for moderators. */
    private InterviewQuestion lockedQuestion(UUID id) {
        var q = questions.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        em.refresh(q);
        if (q.getStatus() == InterviewStatus.DRAFT) throw new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND);
        return q;
    }

    private Moderated detailView(InterviewQuestion q) {
        UUID author = q.getAuthor().getId();
        return view(q, articles.findEligibleAuthorIds(List.of(author)).contains(author));
    }

    private static Moderated view(InterviewQuestion q, boolean eligible) {
        var a = q.getAuthor();
        return new Moderated(InterviewQuestionResponse.of(q), new ArticleAuthorResponse(a.getId(), a.getFullName(), a.getAvatarUrl()),
                eligible, token(q));
    }

    /** A fingerprint, not a credential: any change to the question (status or content) bumps {@code version}. */
    static String token(InterviewQuestion q) {
        try {
            var digest = MessageDigest.getInstance("SHA-256")
                    .digest((q.getId() + ":" + q.getVersion() + ":" + q.getStatus()).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String note(String raw, boolean required, String field) {
        String note = raw == null ? "" : raw.strip();
        // PostgreSQL text cannot hold NUL.
        if (note.indexOf(0) >= 0) throw new CustomException(ErrorCode.VALIDATION_ERROR, Map.of(field, "Invalid character"));
        if (required && note.isEmpty()) throw new CustomException(ErrorCode.VALIDATION_ERROR, Map.of(field, "Hãy ghi lý do (tối đa 1.000 ký tự)."));
        return note.isEmpty() ? null : note;
    }

    private static void checkModerator(User user) {
        if (user == null || !user.isActive() || user.getUserRoles().stream().noneMatch(l -> l.getRole().getName() == RoleName.MODERATOR))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
    }
}
