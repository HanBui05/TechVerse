package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.CourseLessonRow;
import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ModeratorCourseDetailResponse.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.CourseSpecification;
import com.techverse.server.service.ModeratorCourseService;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Course review/publication with the article-flow rules: same lock order, token and notes. */
@Service
@RequiredArgsConstructor
public class ModeratorCourseServiceImpl implements ModeratorCourseService {
    private static final int HISTORY_PREVIEW = 5;
    private final CourseRepository courses;
    private final ArticleRepository articles;
    private final CourseModerationHistoryRepository histories;
    private final CourseVersionLessonRepository versionLessons;
    private final CourseImageReferences imageRefs;
    private final UserRepository users;
    private final AuthorProfileRepository profiles;
    private final TopicRepository topics;
    private final TagRepository tags;
    private final EntityManager entityManager;
    private final ObjectMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ModeratorCourseSummaryResponse> list(UUID actor, ModeratorArticleFilter f) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        if (f.getCreatedFrom() != null && f.getCreatedTo() != null && f.getCreatedFrom().isAfter(f.getCreatedTo()))
            throw new CustomException(ErrorCode.VALIDATION_ERROR);
        var sort = Sort.by(f.getDirection(), f.getSortBy().getProperty()).and(Sort.by(f.getDirection(), "id"));
        var page = courses.findAll(CourseSpecification.moderator(f), PageRequest.of(f.getPage(), f.getSize(), sort));
        var eligible = page.isEmpty()
                ? Set.<UUID>of()
                : articles.findEligibleAuthorIds(page.stream().map(c -> c.getAuthor().getId()).distinct().toList());
        return PageResponse.from(
                page,
                page.stream()
                        .map(c -> new ModeratorCourseSummaryResponse(
                                CourseSummaryResponse.from(c), author(c.getAuthor()), eligible.contains(c.getAuthor().getId())))
                        .toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ModeratorCourseDetailResponse detail(UUID actor, UUID id) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        return detailResponse(found(id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CourseModerationHistoryResponse> history(UUID actor, UUID id, int page, int size) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        found(id);
        var result = histories.findPage(id, PageRequest.of(page, size));
        return PageResponse.from(result, result.stream().map(CourseModerationHistoryResponse::from).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public LessonResponse lesson(UUID actor, UUID id, UUID lessonId, UUID versionId) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        Course course = found(id);
        if (versionId == null)
            return course.activeLessons().stream()
                    .filter(l -> l.getId().equals(lessonId))
                    .findFirst()
                    .map(l -> LessonResponse.from(l, List.of()))
                    .orElseThrow(() -> new CustomException(ErrorCode.LESSON_NOT_FOUND));
        return versionLessons.findInVersion(versionId, lessonId)
                .filter(vl -> vl.getVersion().getCourse().getId().equals(id))
                .map(vl -> LessonResponse.from(vl, List.of()))
                .orElseThrow(() -> new CustomException(ErrorCode.LESSON_NOT_FOUND));
    }

    @Override
    @Transactional
    public ModeratorCourseDetailResponse review(UUID actorId, UUID id, ReviewArticleRequest r) {
        UUID authorId = courses.findAuthorIdById(id).orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        if (actorId.equals(authorId)) throw new CustomException(ErrorCode.COURSE_SELF_REVIEW_NOT_ALLOWED);
        var locked = lock(actorId, authorId, id);
        Course course = locked.course();
        if (course.getPublicationStatus().isTerminal())
            throw new CustomException(ErrorCode.COURSE_PUBLICATION_TRANSITION_INVALID);
        if (course.getWorkflowStatus() != ArticleWorkflowStatus.PENDING)
            throw new CustomException(ErrorCode.COURSE_NOT_PENDING);
        if (!reviewToken(course).equals(r.reviewToken())) throw new CustomException(ErrorCode.COURSE_REVIEW_STALE);
        String note = note(r.moderationNote());
        if (r.decision() == ArticleReviewDecision.REQUEST_CHANGES && note == null)
            throw new CustomException(ErrorCode.COURSE_REVIEW_NOTE_REQUIRED);

        if (r.decision() == ArticleReviewDecision.APPROVE) {
            User author = locked.author();
            var profile = locked.profile();
            if (!author.isActive()
                    || !hasRole(author, RoleName.AUTHOR)
                    || profile == null
                    || profile.getStatus() != AuthorProfileStatus.APPROVED)
                throw new CustomException(ErrorCode.COURSE_AUTHOR_INELIGIBLE);
            checkPublishable(course);
        }
        Instant now = Instant.now();
        var history = r.decision() == ArticleReviewDecision.APPROVE
                ? course.approve(locked.actor(), note, now)
                : course.requestChanges(locked.actor(), note, now);
        // The snapshot is cascaded from Course: insert it before the history row references it.
        courses.flush();
        histories.saveAndFlush(history);
        entityManager.refresh(course);
        return detailResponse(course);
    }

    @Override
    @Transactional
    public ModeratorCourseDetailResponse publication(UUID actorId, UUID id, ArticlePublicationRequest r) {
        var action = r.action();
        if (action == ArticlePublicationAction.UNHIDE || r.reviewToken() == null)
            throw new CustomException(ErrorCode.VALIDATION_ERROR);
        UUID authorId = courses.findAuthorIdById(id).orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        var locked = lock(actorId, authorId, id);
        Course course = locked.course();
        if (!reviewToken(course).equals(r.reviewToken())) throw new CustomException(ErrorCode.COURSE_REVIEW_STALE);
        String note = note(r.moderationNote());
        if (action != ArticlePublicationAction.RESTORE && note == null)
            throw new CustomException(ErrorCode.COURSE_PUBLICATION_NOTE_REQUIRED);
        var history = switch (action) {
            case HIDE -> course.moderatorHide(locked.actor(), note);
            case RESTORE -> course.restore(locked.actor(), note);
            default -> course.remove(locked.actor(), note);
        };
        histories.saveAndFlush(history);
        entityManager.refresh(course);
        return detailResponse(course);
    }

    private record Locked(User actor, User author, AuthorProfile profile, Course course) {}

    /** Users, profile, then the course row (guards its whole tree), as in author writes. */
    private Locked lock(UUID actorId, UUID authorId, UUID id) {
        var lockedUsers = users.findAllByIdForAdminStatusUpdate(List.of(actorId, authorId)).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        lockedUsers.values().forEach(entityManager::refresh);
        User actor = lockedUsers.get(actorId);
        User author = lockedUsers.get(authorId);
        checkModerator(actor);
        if (author == null) throw new CustomException(ErrorCode.COURSE_NOT_FOUND);
        var profile = profiles.findByUserIdForResubmit(authorId).orElse(null);
        if (profile != null) entityManager.refresh(profile);
        Course course = courses.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        entityManager.refresh(course);
        ensureVisible(course);
        if (!course.getAuthor().getId().equals(authorId)) throw new CustomException(ErrorCode.COURSE_REVIEW_STALE);
        return new Locked(actor, author, profile, course);
    }

    /** Taxonomy, tree and changed images may have changed since SUBMIT. */
    private void checkPublishable(Course course) {
        Topic topic = topics.findByIdForUpdate(course.getTopic().getId())
                .orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_READY));
        entityManager.refresh(topic);
        if (!topic.isActive()) throw new CustomException(ErrorCode.COURSE_NOT_READY);
        var tagIds = course.getCourseTags().stream()
                .map(link -> link.getTag().getId())
                .sorted(Comparator.comparing(UUID::toString))
                .toList();
        for (UUID tagId : tagIds) {
            Tag tag = tags.findByIdForUpdate(tagId).orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_READY));
            entityManager.refresh(tag);
            if (!tag.isActive()) throw new CustomException(ErrorCode.COURSE_NOT_READY);
        }
        var chapters = course.activeChapters();
        if (chapters.isEmpty() || chapters.stream().anyMatch(c -> c.activeLessons().isEmpty()))
            throw new CustomException(ErrorCode.COURSE_NOT_READY);
        // Unchanged documents are referenced by the current snapshot, which cleanup never deletes.
        imageRefs.changed(course, course.getDescription(), course.getCoverImageUrl()).forEach(imageRefs::checkLive);
    }

    private Course found(UUID id) {
        Course course = courses.findById(id).orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        ensureVisible(course);
        return course;
    }

    private static void ensureVisible(Course course) {
        // A never-submitted draft is private to its author.
        if (course.getPublicationStatus() == ArticlePublicationStatus.UNPUBLISHED
                && course.getWorkflowStatus() == ArticleWorkflowStatus.DRAFT)
            throw new CustomException(ErrorCode.COURSE_NOT_FOUND);
    }

    private static void checkModerator(User user) {
        if (user == null || !user.isActive() || !hasRole(user, RoleName.MODERATOR))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
    }

    private static boolean hasRole(User user, RoleName role) {
        return user.getUserRoles().stream().anyMatch(link -> link.getRole().getName() == role);
    }

    private static String note(String raw) {
        String note = raw == null ? null : raw.strip();
        return note == null || note.isBlank() ? null : note;
    }

    /** Snapshot, not an authentication token; the fingerprint covers metadata, tags and the tree. */
    private String reviewToken(Course c) {
        var snapshot = new TreeMap<String, Object>();
        snapshot.put("id", c.getId());
        snapshot.put("authorId", c.getAuthor().getId());
        snapshot.put("updatedAt", c.getUpdatedAt());
        snapshot.put("workflowStatus", c.getWorkflowStatus());
        snapshot.put("publicationStatus", c.getPublicationStatus());
        snapshot.put("publishedVersionId", c.getPublishedVersion() == null ? null : c.getPublishedVersion().getId());
        snapshot.put("fingerprint", c.getContentFingerprint());
        snapshot.put("reviewedBy", c.getReviewedBy() == null ? null : c.getReviewedBy().getId());
        snapshot.put("reviewedAt", c.getReviewedAt());
        snapshot.put("moderationNote", c.getModerationNote());
        snapshot.put("publishedAt", c.getPublishedAt());
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(mapper.writeValueAsString(snapshot).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ArticleAuthorResponse author(User user) {
        return new ArticleAuthorResponse(user.getId(), user.getFullName(), user.getAvatarUrl());
    }

    private ModeratorCourseDetailResponse detailResponse(Course c) {
        var v = c.getPublishedVersion();
        var rows = v == null ? List.<CourseLessonRow>of() : versionLessons.findRows(List.of(v.getId()));
        return new ModeratorCourseDetailResponse(
                CourseResponse.from(c, List.of()),
                author(c.getAuthor()),
                reviewToken(c),
                articles.findEligibleAuthorIds(List.of(c.getAuthor().getId())).contains(c.getAuthor().getId()),
                histories.findPage(c.getId(), PageRequest.of(0, HISTORY_PREVIEW)).stream()
                        .map(CourseModerationHistoryResponse::from)
                        .toList(),
                changes(c, v == null ? List.of() : v.getChapters(), rows));
    }

    /**
     * Working active nodes compared with the latest version, then nodes only that version has.
     * Chapters compare title, position and lesson list/order; lessons compare fingerprint (title,
     * summary, content, video, preview), AI flag, position and chapter. No version: all NEW.
     */
    static List<ChangeChapter> changes(Course c, List<CourseVersionChapter> versionChapters, List<CourseLessonRow> rows) {
        var vChapters = new HashMap<UUID, CourseVersionChapter>();
        versionChapters.forEach(vc -> vChapters.put(vc.getChapter().getId(), vc));
        var vLessons = new HashMap<UUID, CourseLessonRow>();
        var vLessonIds = new HashMap<UUID, List<UUID>>();
        rows.forEach(r -> {
            vLessons.put(r.lessonId(), r);
            vLessonIds.computeIfAbsent(r.chapterId(), k -> new ArrayList<>()).add(r.lessonId());
        });
        var activeLessonIds = new HashSet<UUID>();
        c.activeLessons().forEach(l -> activeLessonIds.add(l.getId()));
        var result = new ArrayList<ChangeChapter>();
        var activeChapterIds = new HashSet<UUID>();
        for (CourseChapter chapter : c.activeChapters()) {
            activeChapterIds.add(chapter.getId());
            var lessons = new ArrayList<ChangeLesson>();
            for (Lesson l : chapter.activeLessons()) {
                var row = vLessons.get(l.getId());
                CourseChangeStatus status = row == null
                        ? CourseChangeStatus.NEW
                        : !row.contentFingerprint().equals(l.getContentFingerprint())
                                        || row.aiAssisted() != l.isAiAssisted()
                                        || row.position() != l.getPosition()
                                        || !row.chapterId().equals(chapter.getId())
                                ? CourseChangeStatus.CHANGED
                                : CourseChangeStatus.UNCHANGED;
                lessons.add(new ChangeLesson(l.getId(), l.getTitle(), status));
            }
            archived(vLessonIds.get(chapter.getId()), vLessons, activeLessonIds, lessons);
            var vc = vChapters.get(chapter.getId());
            var ids = chapter.activeLessons().stream().map(Lesson::getId).toList();
            CourseChangeStatus status = vc == null
                    ? CourseChangeStatus.NEW
                    : !vc.getTitle().equals(chapter.getTitle())
                                    || vc.getPosition() != chapter.getPosition()
                                    || !ids.equals(vLessonIds.getOrDefault(chapter.getId(), List.of()))
                            ? CourseChangeStatus.CHANGED
                            : CourseChangeStatus.UNCHANGED;
            result.add(new ChangeChapter(chapter.getId(), chapter.getTitle(), status, lessons));
        }
        for (CourseVersionChapter vc : versionChapters) {
            UUID chapterId = vc.getChapter().getId();
            if (activeChapterIds.contains(chapterId)) continue;
            var lessons = new ArrayList<ChangeLesson>();
            archived(vLessonIds.get(chapterId), vLessons, activeLessonIds, lessons);
            result.add(new ChangeChapter(chapterId, vc.getTitle(), CourseChangeStatus.ARCHIVED, lessons));
        }
        return result;
    }

    /** Version lessons of a chapter that are no longer active anywhere in the working copy. */
    private static void archived(
            List<UUID> versionIds, Map<UUID, CourseLessonRow> vLessons, Set<UUID> active, List<ChangeLesson> out) {
        if (versionIds == null) return;
        for (UUID id : versionIds)
            if (!active.contains(id))
                out.add(new ChangeLesson(id, vLessons.get(id).title(), CourseChangeStatus.ARCHIVED));
    }
}
