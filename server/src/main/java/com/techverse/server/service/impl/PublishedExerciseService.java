package com.techverse.server.service.impl;

import com.techverse.server.dto.request.ExerciseSetRequest;
import com.techverse.server.dto.request.ExerciseSetRequest.Attempt.Answer;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ExercisePracticeResponse.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.TopicSpecification;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Learner side: browse published sets, take them, review own attempts. Quiz answers never leave the
 * server before {@link #submit}; the server grades and stores a self-contained snapshot.
 */
@Service
@RequiredArgsConstructor
public class PublishedExerciseService {
    static final int SUBMITS_PER_MINUTE = 20;

    private final ExerciseSetRepository sets;
    private final ExerciseQuestionRepository questions;
    private final ExerciseAttemptRepository attempts;
    private final UserRepository users;
    private final TopicRepository topics;
    private final AuthorExerciseService rateLimiter;
    private final EntityManager em;

    // ------------------------------------------------------------------ public reads

    @Transactional(readOnly = true)
    public PageResponse<PracticeSet> list(UUID actor, ExerciseSetRequest.PublicFilter f) {
        reader(actor);
        Specification<ExerciseSet> spec = visible();
        if (f.getTopicId() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("topic").get("id"), f.getTopicId()));
        if (f.getDifficulty() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("difficulty"), f.getDifficulty()));
        if (f.getType() != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("type"), f.getType()));
        if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
            String like = "%" + f.getKeyword().strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((r, q, cb) -> cb.like(cb.lower(r.get("title")), like, '\\'));
        }
        var page = sets.findAll(spec, PageRequest.of(f.getPage(), f.getSize(),
                Sort.by(Sort.Direction.DESC, "publishedAt").and(Sort.by("id"))));
        var ids = page.stream().map(ExerciseSet::getId).toList();
        var counts = new HashMap<UUID, Long>();
        var last = new HashMap<UUID, ExerciseAttempt>();
        if (!ids.isEmpty()) {
            for (Object[] row : questions.countBySets(ids)) counts.put((UUID) row[0], (Long) row[1]);
            if (actor != null) for (var a : attempts.latestFor(actor, ids)) last.putIfAbsent(a.getExerciseSet().getId(), a);
        }
        return PageResponse.from(page, page.stream()
                .map(s -> summary(s, counts.getOrDefault(s.getId(), 0L), last.get(s.getId()), null)).toList());
    }

    @Transactional(readOnly = true)
    public List<ArticleOptionResponse> options() {
        return topics.findAll(TopicSpecification.hasActiveStatus(true), Sort.by("name", "id")).stream()
                .map(t -> new ArticleOptionResponse(t.getId(), t.getName(), t.isActive())).toList();
    }

    @Transactional(readOnly = true)
    public PracticeSet detail(UUID actor, UUID id) {
        var user = reader(actor);
        var set = visibleSet(id);
        var last = actor == null ? null : attempts.latestFor(actor, List.of(id)).stream().findFirst().orElse(null);
        String reason = reason(user, set);
        return summary(set, questions.countByExerciseSetId(id), last, new Viewer(reason == null, reason));
    }

    // ------------------------------------------------------------------ taking a set

    @Transactional(readOnly = true)
    public Questions questions(UUID actor, UUID id) {
        var user = reader(actor);
        var set = visibleSet(id);
        if (reason(user, set) != null) throw new CustomException(ErrorCode.ACCESS_DENIED);
        var list = questions.findByExerciseSetIdOrderByPositionAsc(id);
        boolean card = set.getType() == ExerciseType.FLASHCARD;
        return new Questions(id, set.getType(), list.stream().<Object>map(q -> card
                ? new CardQuestion(q.getId(), q.getPosition(), q.getContent(), q.getAnswer(), q.getExplanation())
                : new QuizQuestion(q.getId(), q.getPosition(), q.getContent(), q.getCodeSnippet(), q.getCodeLanguage(), q.getOptions()))
                .toList());
    }

    /**
     * Order: permission, key format, replay of a stored attempt (even if the set is gone), rate limit,
     * then set state under a shared row lock so a concurrent hide either precedes or follows the insert.
     */
    @Transactional
    public Attempt submit(UUID actor, UUID id, String keyText, ExerciseSetRequest.Attempt request) {
        // Row lock: an admin locking the account either finishes before this check or waits for the insert.
        var user = users.findByIdForAuthentication(actor).orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        em.refresh(user);
        if (!user.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
        if (isStaff(user) || sets.findAuthorIdById(id).filter(actor::equals).isPresent())
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        UUID key = key(keyText);
        // Serialises same-key requests: the loser waits, then finds the stored attempt below.
        em.createNativeQuery("select count(*) from (select pg_advisory_xact_lock(hashtextextended(:k, 0))) s")
                .setParameter("k", actor + ":" + key).getSingleResult();
        var stored = attempts.findByUserIdAndIdempotencyKey(actor, key);
        if (stored.isPresent()) {
            if (!stored.get().getExerciseSet().getId().equals(id)) throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_KEY_CONFLICT);
            return Attempt.of(stored.get(), true);
        }
        rateLimiter.rateLimit("exercise:rate:submit:" + actor, SUBMITS_PER_MINUTE);
        var set = sets.findByIdForShare(id).orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND));
        em.refresh(set);
        if (!sets.exists(visible().and((r, q, cb) -> cb.equal(r.get("id"), id))))
            throw new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND);
        var graded = grade(set, questions.findByExerciseSetIdOrderByPositionAsc(id), request);
        try {
            return Attempt.of(attempts.saveAndFlush(ExerciseAttempt.of(user, set, key, graded.snapshot(), graded.correct(),
                    graded.total(), duration(request))), true);
        } catch (DataIntegrityViolationException e) {
            throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_KEY_CONFLICT);
        }
    }

    // ------------------------------------------------------------------ history

    @Transactional(readOnly = true)
    public PageResponse<Attempt> history(UUID actor, ExerciseSetRequest.AttemptFilter f) {
        reader(actor);
        var paging = PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.DESC, "completedAt").and(Sort.by("id")));
        var page = f.getExerciseSetId() == null
                ? attempts.findByUserId(actor, paging)
                : attempts.findByUserIdAndExerciseSetId(actor, f.getExerciseSetId(), paging);
        return PageResponse.from(page, page.stream().map(a -> Attempt.of(a, false)).toList());
    }

    @Transactional(readOnly = true)
    public Attempt attempt(UUID actor, UUID id) {
        reader(actor);
        return attempts.findByIdAndUserId(id, actor).map(a -> Attempt.of(a, true))
                .orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_ATTEMPT_NOT_FOUND));
    }

    // ------------------------------------------------------------------ helpers

    /** Published, author active and not suspended (derived in SQL, like articles and courses). */
    private static Specification<ExerciseSet> visible() {
        return (root, q, cb) -> {
            var suspended = q.subquery(UUID.class);
            var profile = suspended.from(AuthorProfile.class);
            suspended.select(profile.get("id")).where(cb.equal(profile.get("user"), root.get("author")),
                    cb.equal(profile.get("status"), AuthorProfileStatus.SUSPENDED));
            return cb.and(cb.equal(root.get("status"), ExerciseStatus.PUBLISHED), cb.isTrue(root.get("author").get("active")),
                    cb.not(cb.exists(suspended)));
        };
    }

    private ExerciseSet visibleSet(UUID id) {
        return sets.findOne(visible().and((r, q, cb) -> cb.equal(r.get("id"), id)))
                .orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND));
    }

    /** Null for guests; a locked account is rejected everywhere. */
    private User reader(UUID actor) {
        if (actor == null) return null;
        var user = users.findWithRolesById(actor).orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        if (!user.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
        return user;
    }

    private static boolean isStaff(User user) {
        return user != null && user.getUserRoles().stream()
                .anyMatch(l -> l.getRole().getName() == RoleName.MODERATOR || l.getRole().getName() == RoleName.ADMIN);
    }

    /** Why the viewer cannot take the set, or null when they can. */
    private static String reason(User user, ExerciseSet set) {
        if (user == null) return "LOGIN_REQUIRED";
        if (isStaff(user)) return "STAFF";
        return set.getAuthor().getId().equals(user.getId()) ? "OWNER" : null;
    }

    private static UUID key(String text) {
        try {
            if (text != null) return UUID.fromString(text.strip());
        } catch (IllegalArgumentException ignored) {
            // falls through to the validation error
        }
        throw new CustomException(ErrorCode.VALIDATION_ERROR, Map.of("Idempotency-Key", "A UUID is required"));
    }

    private static PracticeSet summary(ExerciseSet s, long count, ExerciseAttempt last, Viewer viewer) {
        var t = s.getTopic();
        var a = s.getAuthor();
        return new PracticeSet(s.getId(), s.getTitle(), s.getDescription(), new ArticleOptionResponse(t.getId(), t.getName(), t.isActive()),
                s.getType(), s.getDifficulty(), count, new ArticleAuthorResponse(a.getId(), a.getFullName(), a.getAvatarUrl()),
                s.getPublishedAt(), last == null ? null : Attempt.of(last, false), viewer);
    }

    // ------------------------------------------------------------------ grading (pure)

    public record Graded(int correct, int total, Map<String, Object> snapshot) {}

    private static int duration(ExerciseSetRequest.Attempt r) {
        int d = r.durationSeconds() == null ? 0 : r.durationSeconds();
        if (d < 0 || d > 86_400) throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID);
        return d;
    }

    /** Grades a quiz (blank = wrong) or counts remembered cards and builds the snapshot stored with the attempt. */
    public static Graded grade(ExerciseSet set, List<ExerciseQuestion> qs, ExerciseSetRequest.Attempt r) {
        boolean card = set.getType() == ExerciseType.FLASHCARD;
        if ((card ? r.answers() : r.results()) != null) throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID);
        int duration = duration(r);
        var byId = qs.stream().collect(Collectors.toMap(ExerciseQuestion::getId, q -> q));
        var given = new HashMap<UUID, Object>();
        var sent = card ? Optional.ofNullable(r.results()).orElse(List.of()) : Optional.ofNullable(r.answers()).orElse(List.of());
        for (Object o : sent) {
            UUID qid;
            Object value;
            if (o instanceof Answer a) {
                qid = a.questionId();
                value = a.selectedIndex();
                if (qid == null || !byId.containsKey(qid)) throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID);
                if (value != null &&((int) value < 0 || (int) value >= byId.get(qid).getOptions().size()))
                    throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID);
            } else if (o instanceof ExerciseSetRequest.Attempt.Remembered m) {
                qid = m.questionId();
                value = m.remembered();
                if (value == null) throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID);
            } else {
                throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID);
            }
            if (qid == null || !byId.containsKey(qid) || given.containsKey(qid)) throw new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID);
            given.put(qid, value);
        }
        int correct = 0;
        var items = new ArrayList<Map<String, Object>>();
        for (var q : qs) {
            var item = new LinkedHashMap<String, Object>();
            item.put("questionId", q.getId());
            item.put("position", q.getPosition());
            if (card) {
                boolean remembered = Boolean.TRUE.equals(given.get(q.getId()));
                if (remembered) correct++;
                item.put("front", q.getContent());
                item.put("back", q.getAnswer());
                item.put("explanation", q.getExplanation());
                item.put("remembered", remembered);
            } else {
                int right = Integer.parseInt(q.getAnswer());
                Integer picked = (Integer) given.get(q.getId());
                boolean ok = picked != null && picked == right;
                if (ok) correct++;
                item.put("content", q.getContent());
                item.put("codeSnippet", q.getCodeSnippet());
                item.put("codeLanguage", q.getCodeLanguage());
                item.put("options", q.getOptions());
                item.put("correctIndex", right);
                item.put("selectedIndex", picked);
                item.put("correct", ok);
                item.put("explanation", q.getExplanation());
            }
            items.add(item);
        }
        var snapshot = new LinkedHashMap<String, Object>();
        snapshot.put("title", set.getTitle());
        snapshot.put("type", set.getType().name());
        snapshot.put("durationSeconds", duration);
        snapshot.put("items", items);
        return new Graded(correct, qs.size(), snapshot);
    }
}
