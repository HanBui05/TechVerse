package com.techverse.server.service.impl;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.request.ExerciseSetRequest.Question;
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
 * Author side of exercise sets. Lock order: users, author profile ({@link ArticleAccessService}), the
 * {@code exercise_sets} row (guards its questions), then the topic.
 */
@Service
@RequiredArgsConstructor
public class AuthorExerciseService {
    static final int MAX_QUESTIONS = 50;
    static final int CREATES_PER_MINUTE = 10;
    private static final String COPY_SUFFIX = " (bản sao)";
    private static final DefaultRedisScript<Long> COUNTER =
            new DefaultRedisScript<>(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
                    Long.class);

    private final ArticleAccessService access;
    private final ArticleContentService markdown;
    private final ExerciseSetRepository sets;
    private final ExerciseQuestionRepository questions;
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
    public PageResponse<ExerciseSetResponse> list(UUID actor, ExerciseSetRequest.Filter f) {
        access.checkReader(actor);
        Specification<ExerciseSet> spec = (root, q, cb) -> cb.equal(root.get("author").get("id"), actor);
        if (f.getStatus() != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), f.getStatus()));
        if (f.getType() != null) spec = spec.and((root, q, cb) -> cb.equal(root.get("type"), f.getType()));
        if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
            String like = "%" + f.getKeyword().strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            spec = spec.and((root, q, cb) -> cb.like(cb.lower(root.get("title")), like, '\\'));
        }
        var page = sets.findAll(spec, PageRequest.of(f.getPage(), f.getSize(), Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
        var counts = new HashMap<UUID, Long>();
        if (!page.isEmpty())
            for (Object[] row : questions.countBySets(page.stream().map(ExerciseSet::getId).toList()))
                counts.put((UUID) row[0], (Long) row[1]);
        return PageResponse.from(page, page.stream().map(s -> ExerciseSetResponse.of(s, counts.getOrDefault(s.getId(), 0L), null)).toList());
    }

    @Transactional(readOnly = true)
    public ExerciseSetResponse detail(UUID actor, UUID id) {
        access.checkReader(actor);
        var set = sets.findById(id).filter(s -> s.getAuthor().getId().equals(actor))
                .orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND));
        return view(set);
    }

    // ------------------------------------------------------------------ writes

    @Transactional
    public ExerciseSetResponse create(UUID actor, ExerciseSetRequest.Create r) {
        var user = access.lockWriter(actor);
        rateLimit("exercise:rate:create:" + actor, CREATES_PER_MINUTE);
        noNul("title", r.title());
        noNul("description", r.description());
        var topic = activeTopic(r.topicId());
        var set = sets.save(ExerciseSet.create(user, topic, r.title(), r.description() == null ? "" : r.description(),
                ExerciseType.valueOf(r.type()), ExerciseDifficulty.valueOf(r.difficulty())));
        return flushed(set);
    }

    @Transactional
    public ExerciseSetResponse update(UUID actor, UUID id, ExerciseSetRequest.Update r) {
        access.lockWriter(actor);
        var set = lockOwned(actor, id);
        set.ensureEditable();
        set.ensureVersion(r.version());
        noNul("title", r.title());
        noNul("description", r.description());
        // The kept topic must be active too ("active when saving").
        Topic topic = activeTopic(r.topicId() == null ? set.getTopic().getId() : r.topicId());
        set.edit(r.title(), r.description(), topic,
                r.difficulty() == null ? null : ExerciseDifficulty.valueOf(r.difficulty()));
        return flushed(set);
    }

    @Transactional
    public ExerciseSetResponse replaceQuestions(UUID actor, UUID id, ExerciseSetRequest.Questions r) {
        access.lockWriter(actor);
        var set = lockOwned(actor, id);
        set.ensureEditable();
        set.ensureVersion(r.version());
        activeTopic(set.getTopic().getId());
        var clean = normalize(set.getType(), r.questions());
        clean.forEach(this::checkContent);
        questions.deleteBySet(set.getId());
        boolean card = set.getType() == ExerciseType.FLASHCARD;
        int position = 1;
        for (var q : clean)
            questions.save(card
                    ? ExerciseQuestion.of(set, position++, q.front(), null, null, null, q.back(), q.explanation())
                    : ExerciseQuestion.of(set, position++, q.content(), q.codeSnippet(), q.codeLanguage(), q.options(),
                            String.valueOf(q.correctIndex()), q.explanation()));
        set.bump();
        return flushed(set);
    }

    // ------------------------------------------------------------------ AI question suggestions (1c)

    /** Plain copy of what the model may see; no entity crosses the provider call. */
    public record AiContext(ExerciseType type, String title, String description, String topic,
            ExerciseDifficulty difficulty, List<String> existing, int version) {}

    /** Run inside a transaction: owner, Author eligibility, editable state, the 50-question cap and the client's version. */
    public AiContext aiContext(UUID actor, UUID id, int adding, int clientVersion) {
        var set = editableForAi(actor, id, adding);
        set.ensureVersion(clientVersion);
        var existing = questions.findByExerciseSetIdOrderByPositionAsc(set.getId()).stream()
                .map(q -> q.getContent().length() > 200 ? q.getContent().substring(0, 200) : q.getContent()).toList();
        return new AiContext(set.getType(), set.getTitle(), set.getDescription(), set.getTopic().getName(),
                set.getDifficulty(), existing, set.getVersion());
    }

    /** Run inside a transaction after the model answered: re-check everything (the set must still be at {@code expectedVersion}), then flag it. Returns the new version. */
    public int markAiAssisted(UUID actor, UUID id, int adding, int expectedVersion) {
        var set = editableForAi(actor, id, adding);
        set.ensureVersion(expectedVersion);
        set.markAiAssisted();
        sets.flush();
        return set.getVersion();
    }

    /** The cleaned question when it passes the same checks as {@code PUT questions}, else null. */
    public Question aiUsable(ExerciseType type, Question q) {
        try {
            var clean = normalize(type, List.of(q)).get(0);
            checkContent(clean);
            // The AI contract is exactly four options (the save rules allow 2 to 6).
            return type == ExerciseType.MULTIPLE_CHOICE && clean.options().size() != 4 ? null : clean;
        } catch (CustomException e) {
            return null;
        }
    }

    private ExerciseSet editableForAi(UUID actor, UUID id, int adding) {
        access.lockWriter(actor);
        var set = lockOwned(actor, id);
        set.ensureEditable();
        if (questions.countByExerciseSetId(set.getId()) + adding > MAX_QUESTIONS)
            throw new CustomException(ErrorCode.EXERCISE_QUESTIONS_INVALID, Map.of("questions", "At most " + MAX_QUESTIONS + " questions"));
        return set;
    }

    private void checkContent(Question q) {
        for (String text : new String[] {q.content(), q.explanation(), q.front(), q.back()}) checkMarkdown(text);
        // PostgreSQL text/jsonb cannot hold NUL.
        for (String text : new String[] {q.codeSnippet(), q.codeLanguage()}) if (hasNul(text)) throw new CustomException(ErrorCode.EXERCISE_CONTENT_INVALID);
        if (q.options() != null) for (String o : q.options()) if (hasNul(o)) throw new CustomException(ErrorCode.EXERCISE_CONTENT_INVALID);
    }

    @Transactional
    public ExerciseSetResponse submit(UUID actor, UUID id) {
        access.lockWriter(actor);
        var set = lockOwned(actor, id);
        // Topic is locked after the set (documented lock order); state is checked first via submit().
        set.submit(questions.countByExerciseSetId(set.getId()));
        var topic = topics.findByIdForUpdate(set.getTopic().getId()).orElseThrow();
        if (!topic.isActive()) throw new CustomException(ErrorCode.EXERCISE_NOT_READY);
        return flushed(set);
    }

    @Transactional
    public ExerciseSetResponse withdraw(UUID actor, UUID id) {
        access.lockWriter(actor);
        var set = lockOwned(actor, id);
        set.withdraw();
        return flushed(set);
    }

    @Transactional
    public ExerciseSetResponse visibility(UUID actor, UUID id, ArticlePublicationRequest r) {
        access.lockWriter(actor);
        var set = lockOwned(actor, id);
        switch (r.action()) {
            case HIDE -> set.authorHide();
            case UNHIDE -> set.authorUnhide();
            default -> throw new CustomException(ErrorCode.EXERCISE_STATE_INVALID);
        }
        return flushed(set);
    }

    @Transactional
    public ExerciseSetResponse copy(UUID actor, UUID id) {
        var user = access.lockWriter(actor);
        var src = lockOwned(actor, id);
        rateLimit("exercise:rate:create:" + actor, CREATES_PER_MINUTE);
        var topic = topics.findByIdForUpdate(src.getTopic().getId()).orElseThrow();
        if (!topic.isActive()) throw new CustomException(ErrorCode.EXERCISE_TOPIC_INACTIVE);
        String title = src.getTitle();
        if (title.length() + COPY_SUFFIX.length() > 255) title = title.substring(0, 255 - COPY_SUFFIX.length());
        var copy = sets.save(ExerciseSet.create(user, topic, title + COPY_SUFFIX, src.getDescription(), src.getType(), src.getDifficulty()));
        if (src.isAiAssisted()) copy.markAiAssisted();
        for (var q : questions.findByExerciseSetIdOrderByPositionAsc(src.getId()))
            questions.save(ExerciseQuestion.of(copy, q.getPosition(), q.getContent(), q.getCodeSnippet(), q.getCodeLanguage(),
                    q.getOptions() == null ? null : new ArrayList<>(q.getOptions()), q.getAnswer(), q.getExplanation()));
        return flushed(copy);
    }

    @Transactional
    public void delete(UUID actor, UUID id) {
        access.lockActiveUser(actor);
        var set = lockOwned(actor, id);
        set.ensureDeletable();
        try {
            questions.deleteBySet(set.getId());
            sets.delete(set);
            sets.flush();
        } catch (DataAccessException | jakarta.persistence.PersistenceException e) {
            // E.g. the trigger that protects sets with attempts.
            throw new CustomException(ErrorCode.EXERCISE_NOT_DELETABLE);
        }
    }

    // ------------------------------------------------------------------ helpers

    private ExerciseSet lockOwned(UUID actor, UUID id) {
        var set = sets.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND));
        // OSIV keeps entities across transactions; make sure the locked row is read fresh.
        em.refresh(set);
        if (!set.getAuthor().getId().equals(actor)) throw new CustomException(ErrorCode.EXERCISE_SET_NOT_FOUND);
        return set;
    }

    private Topic activeTopic(UUID id) {
        var topic = topics.findByIdForUpdate(id)
                .orElseThrow(() -> new CustomException(ErrorCode.VALIDATION_ERROR, Map.of("topicId", "Topic not found")));
        if (!topic.isActive()) throw new CustomException(ErrorCode.EXERCISE_TOPIC_INACTIVE);
        return topic;
    }

    /** Fixed one-minute window; an unreachable Redis never lets a request through. Shared with practice submits. */
    void rateLimit(String key, int limit) {
        try {
            Long n = redis.execute(COUNTER, List.of(key));
            if (n == null) throw new CustomException(ErrorCode.EXERCISE_STORAGE_UNAVAILABLE);
            if (n > limit) throw new CustomException(ErrorCode.EXERCISE_RATE_LIMITED);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.EXERCISE_STORAGE_UNAVAILABLE);
        }
    }

    private static boolean hasNul(String s) {
        return s != null && s.indexOf(0) >= 0;
    }

    private static void noNul(String field, String value) {
        if (hasNul(value)) throw new CustomException(ErrorCode.VALIDATION_ERROR, Map.of(field, "Invalid character"));
    }

    private void checkMarkdown(String text) {
        if (text == null || text.isEmpty()) return;
        try {
            markdown.validateContent(text);
        } catch (CustomException e) {
            throw new CustomException(ErrorCode.EXERCISE_CONTENT_INVALID);
        }
        if (!markdown.imageUrls(text).isEmpty()) throw new CustomException(ErrorCode.EXERCISE_CONTENT_INVALID);
    }

    private ExerciseSetResponse flushed(ExerciseSet set) {
        sets.flush();
        return view(set);
    }

    private ExerciseSetResponse view(ExerciseSet set) {
        var list = questions.findByExerciseSetIdOrderByPositionAsc(set.getId());
        return ExerciseSetResponse.of(set, list.size(), list);
    }

    /**
     * Structural validation of a full question list; returns trimmed copies. Pure: every problem is
     * collected under {@code questions[i].<field>} and thrown at once.
     */
    public static List<Question> normalize(ExerciseType type, List<Question> input) {
        var errors = new LinkedHashMap<String, String>();
        if (input.size() > MAX_QUESTIONS) errors.put("questions", "At most " + MAX_QUESTIONS + " questions");
        var out = new ArrayList<Question>();
        boolean card = type == ExerciseType.FLASHCARD;
        for (int i = 0; i < input.size() && i <= MAX_QUESTIONS; i++) {
            var q = input.get(i);
            String at = "questions[" + i + "]";
            if (q == null) {
                errors.put(at, "Required");
                continue;
            }
            String content = trim(q.content()), explanation = trim(q.explanation());
            String front = trim(q.front()), back = trim(q.back());
            String snippet = q.codeSnippet() == null || q.codeSnippet().isBlank() ? null : q.codeSnippet();
            String language = trim(q.codeLanguage());
            List<String> options = null;
            if (card) {
                forbid(errors, at + ".content", q.content());
                forbid(errors, at + ".codeSnippet", q.codeSnippet());
                forbid(errors, at + ".codeLanguage", q.codeLanguage());
                forbid(errors, at + ".options", q.options());
                forbid(errors, at + ".correctIndex", q.correctIndex());
                range(errors, at + ".front", front, 1, 1000);
                range(errors, at + ".back", back, 1, 1000);
                if (explanation == null) explanation = "";
                else range(errors, at + ".explanation", explanation, 0, 2000);
            } else {
                forbid(errors, at + ".front", q.front());
                forbid(errors, at + ".back", q.back());
                range(errors, at + ".content", content, 1, 2000);
                range(errors, at + ".explanation", explanation, 1, 2000);
                if (snippet != null) {
                    if (snippet.length() > 5000) errors.put(at + ".codeSnippet", "At most 5000 characters");
                    range(errors, at + ".codeLanguage", language, 1, 50);
                }
                options = options(errors, at, q.options());
                if (q.correctIndex() == null || options == null || q.correctIndex() < 0 || q.correctIndex() >= options.size())
                    errors.put(at + ".correctIndex", "Must point at an option");
            }
            out.add(new Question(content, snippet, snippet == null ? null : language, options, q.correctIndex(), explanation, front, back));
        }
        if (!errors.isEmpty()) throw new CustomException(ErrorCode.EXERCISE_QUESTIONS_INVALID, errors);
        return out;
    }

    private static List<String> options(Map<String, String> errors, String at, List<String> raw) {
        String key = at + ".options";
        if (raw == null || raw.size() < 2 || raw.size() > 6) {
            errors.put(key, "2 to 6 options");
            return null;
        }
        var clean = new ArrayList<String>();
        for (String o : raw) {
            String t = trim(o);
            if (t == null || t.isEmpty() || t.length() > 500) errors.putIfAbsent(key, "Each option is 1 to 500 characters");
            clean.add(t);
        }
        if (new HashSet<>(clean).size() != clean.size()) errors.putIfAbsent(key, "Options must differ");
        return clean;
    }

    private static String trim(String s) {
        return s == null ? null : s.strip();
    }

    private static void forbid(Map<String, String> errors, String key, Object value) {
        if (value != null) errors.put(key, "Not allowed for this exercise type");
    }

    private static void range(Map<String, String> errors, String key, String v, int min, int max) {
        if (v == null ? min > 0 : v.length() < min || v.length() > max) errors.put(key, "Must be " + min + " to " + max + " characters");
    }
}
