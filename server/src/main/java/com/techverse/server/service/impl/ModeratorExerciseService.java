package com.techverse.server.service.impl;

import com.techverse.server.dto.request.ExerciseSetRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ExercisePracticeResponse.Moderated;
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

/**
 * Moderator review and publication of exercise sets. Lock order: users, author profile, the set row,
 * then the topic. The review token is derived from {@code version}, which every change bumps.
 */
@Service
@RequiredArgsConstructor
public class ModeratorExerciseService {
    private final ExerciseSetRepository sets;
    private final ExerciseQuestionRepository questions;
    private final UserRepository users;
    private final AuthorProfileRepository profiles;
    private final ArticleRepository articles;
    private final TopicRepository topics;
    private final EntityManager em;

    @Transactional(readOnly = true)
    public PageResponse<Moderated> list(UUID actor, ExerciseSetRequest.ModeratorFilter f) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        // Drafts (including withdrawn ones) are private to the author; default view is the review queue.
        var status = f.getStatus() == null ? ExerciseStatus.PENDING : f.getStatus();
        Specification<ExerciseSet> spec = (r, q, cb) -> cb.and(cb.notEqual(r.get("status"), ExerciseStatus.DRAFT), cb.equal(r.get("status"), status));
        if (f.getType() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("type"), f.getType()));
        if (f.getTopicId() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("topic").get("id"), f.getTopicId()));
        if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
            String like = "%" + f.getKeyword().strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((r, q, cb) -> cb.like(cb.lower(r.get("title")), like, '\\'));
        }
        var page = sets.findAll(spec, PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.ASC, "updatedAt").and(Sort.by("id"))));
        var ids = page.stream().map(ExerciseSet::getId).toList();
        var counts = new HashMap<UUID, Long>();
        Set<UUID> eligible = Set.of();
        if (!ids.isEmpty()) {
            for (Object[] row : questions.countBySets(ids)) counts.put((UUID) row[0], (Long) row[1]);
            eligible = articles.findEligibleAuthorIds(page.stream().map(s -> s.getAuthor().getId()).distinct().toList());
        }
        var ok = eligible;
        return PageResponse.from(page, page.stream()
                .map(s -> view(s, counts.getOrDefault(s.getId(), 0L), null, ok.contains(s.getAuthor().getId()))).toList());
    }

    @Transactional(readOnly = true)
    public Moderated detail(UUID actor, UUID id) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        var set = sets.findById(id).filter(s -> s.getStatus() != ExerciseStatus.DRAFT)
                .orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND));
        return detailView(set);
    }

    @Transactional
    public Moderated review(UUID actor, UUID id, ExerciseSetRequest.Review r) {
        boolean approve = r.decision() == ArticleReviewDecision.APPROVE;
        String note = note(r.note(), !approve, "note");
        UUID authorId = sets.findAuthorIdById(id).orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND));
        var locked = users.findAllByIdForAdminStatusUpdate(List.of(actor, authorId)).stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u));
        locked.values().forEach(em::refresh);
        User moderator = locked.get(actor);
        checkModerator(moderator);
        var profile = profiles.findByUserIdForResubmit(authorId).orElse(null);
        if (profile != null) em.refresh(profile);
        var set = lockedSet(id);
        if (!token(set).equals(r.reviewToken())) throw new CustomException(ErrorCode.EXERCISE_REVIEW_STALE);
        if (set.getStatus() != ExerciseStatus.PENDING) throw new CustomException(ErrorCode.EXERCISE_STATE_INVALID);
        if (approve) {
            User author = locked.get(authorId);
            if (author == null || !author.isActive()
                    || author.getUserRoles().stream().noneMatch(l -> l.getRole().getName() == RoleName.AUTHOR)
                    || profile == null || profile.getStatus() != AuthorProfileStatus.APPROVED)
                throw new CustomException(ErrorCode.EXERCISE_AUTHOR_INELIGIBLE);
            var topic = topics.findByIdForUpdate(set.getTopic().getId()).orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_TOPIC_INACTIVE));
            em.refresh(topic);
            if (!topic.isActive()) throw new CustomException(ErrorCode.EXERCISE_TOPIC_INACTIVE);
            if (questions.countByExerciseSetId(id) < ExerciseSet.minQuestions(set.getType()))
                throw new CustomException(ErrorCode.EXERCISE_NOT_READY);
            set.approve(moderator, note);
        } else {
            set.requestChanges(moderator, note);
        }
        sets.flush();
        return detailView(set);
    }

    @Transactional
    public Moderated publication(UUID actor, UUID id, ExerciseSetRequest.Publication r) {
        if (r.action() == ArticlePublicationAction.UNHIDE) throw new CustomException(ErrorCode.VALIDATION_ERROR, Map.of("action", "Not allowed"));
        String note = note(r.reason(), r.action() != ArticlePublicationAction.RESTORE, "reason");
        User moderator = users.findAllByIdForAdminStatusUpdate(List.of(actor)).stream().findFirst().orElse(null);
        if (moderator != null) em.refresh(moderator);
        checkModerator(moderator);
        var set = lockedSet(id);
        if (!token(set).equals(r.reviewToken())) throw new CustomException(ErrorCode.EXERCISE_REVIEW_STALE);
        switch (r.action()) {
            case HIDE -> set.moderatorHide(moderator, note);
            case RESTORE -> set.moderatorRestore(moderator, note);
            default -> set.remove(moderator, note);
        }
        sets.flush();
        return detailView(set);
    }

    // ------------------------------------------------------------------ helpers

    /** A never-published draft is private to its author, so it does not exist for moderators. */
    private ExerciseSet lockedSet(UUID id) {
        var set = sets.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND));
        em.refresh(set);
        if (set.getStatus() == ExerciseStatus.DRAFT) throw new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND);
        return set;
    }

    private Moderated detailView(ExerciseSet set) {
        var list = questions.findByExerciseSetIdOrderByPositionAsc(set.getId());
        boolean eligible = articles.findEligibleAuthorIds(List.of(set.getAuthor().getId())).contains(set.getAuthor().getId());
        return view(set, list.size(), list, eligible);
    }

    private static Moderated view(ExerciseSet s, long count, List<ExerciseQuestion> list, boolean eligible) {
        var a = s.getAuthor();
        return new Moderated(ExerciseSetResponse.of(s, count, list), new ArticleAuthorResponse(a.getId(), a.getFullName(), a.getAvatarUrl()),
                eligible, token(s));
    }

    /** A fingerprint, not a credential: any change to the set (status or content) bumps {@code version}. */
    static String token(ExerciseSet s) {
        try {
            var digest = MessageDigest.getInstance("SHA-256")
                    .digest((s.getId() + ":" + s.getVersion() + ":" + s.getStatus()).getBytes(StandardCharsets.UTF_8));
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
