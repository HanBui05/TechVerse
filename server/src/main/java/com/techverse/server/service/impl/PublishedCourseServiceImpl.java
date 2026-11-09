package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.CourseLessonRow;
import com.techverse.server.dto.request.PublishedCourseFilter;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.CourseProgressResponse.*;
import com.techverse.server.dto.response.PublishedCourseDetailResponse.Viewer;
import com.techverse.server.entity.*;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.CourseSpecification;
import com.techverse.server.service.PublishedCourseService;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Readers only see the current snapshot of visible courses. Owners and accounts with MODERATOR or
 * ADMIN read like guests (previews only) and can neither start nor complete lessons.
 */
@Service
@RequiredArgsConstructor
public class PublishedCourseServiceImpl implements PublishedCourseService {
    private final CourseRepository courses;
    private final CoursePublicationVersionRepository versions;
    private final CourseVersionLessonRepository versionLessons;
    private final CourseEnrollmentRepository enrollments;
    private final LessonProgressRepository progress;
    private final PublishedArticleRepository articles;
    private final UserRepository users;

    /** Signed-in reader; {@code learner} = may enroll in this course (not owner, not a manager). */
    private record Reader(UUID id, boolean manager) {
        boolean canLearn(Course course) {
            return !manager && !course.getAuthor().getId().equals(id);
        }
    }

    /** Current snapshot: chapters plus lesson rows (no Markdown) in reading order. */
    private record Tree(CoursePublicationVersion version, List<CourseVersionChapter> chapters, List<CourseLessonRow> rows) {
        Optional<CourseLessonRow> lesson(UUID id) {
            return rows.stream().filter(r -> r.lessonId().equals(id)).findFirst();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<PublishedCourseSummaryResponse> list(UUID actor, PublishedCourseFilter f) {
        reader(actor);
        var direction = f.getSort().getDirection();
        var sort = Sort.by(direction, "publishedAt").and(Sort.by(direction, "id"));
        var page = courses.findAll(CourseSpecification.published(f), PageRequest.of(f.getPage(), f.getSize(), sort));
        var tags = tags(page.stream().map(c -> c.getPublishedVersion().getId()).toList());
        return PageResponse.from(
                page,
                page.stream()
                        .map(c -> PublishedCourseSummaryResponse.from(c, tags.getOrDefault(c.getPublishedVersion().getId(), List.of())))
                        .toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PublishedCourseDetailResponse detail(UUID actor, UUID id) {
        Reader reader = reader(actor);
        Course course = visible(id);
        Tree tree = tree(course);
        var enrollment = enrollment(reader, course);
        var v = tree.version();
        var profile = articles.findAuthorProfile(course.getAuthor().getId()).orElse(new Object[2]);
        var author = course.getAuthor();
        return PublishedCourseDetailResponse.builder()
                .id(course.getId())
                .title(v.getTitle())
                .summary(v.getSummary())
                .description(v.getDescription())
                .coverImageUrl(v.getCoverImageUrl())
                .level(v.getLevel())
                .topic(new ArticleTaxonomyResponse(v.getTopic().getId(), v.getTopic().getName()))
                .tags(tags(List.of(v.getId())).getOrDefault(v.getId(), List.of()))
                .author(PublishedArticleAuthorResponse.builder()
                        .id(author.getId())
                        .fullName(author.getFullName())
                        .avatarUrl(author.getAvatarUrl())
                        .expertise((String) profile[0])
                        .bioExcerpt(PublishedArticleAuthorResponse.excerpt((String) profile[1]))
                        .build())
                .versionNumber(v.getVersionNumber())
                .publishedAt(course.getPublishedAt())
                .updatedAt(v.getApprovedAt())
                .chapterCount(tree.chapters().size())
                .lessonCount(tree.rows().size())
                .chapters(curriculum(tree))
                .viewer(viewer(reader, course, enrollment))
                .learning(enrollment.map(e -> learning(reader.id(), course, tree, e.getLastLessonId())).orElse(null))
                .build();
    }

    @Override
    @Transactional
    public PublishedLessonResponse lesson(UUID actor, UUID courseId, UUID lessonId) {
        Reader reader = reader(actor);
        Course course = visible(courseId);
        Tree tree = tree(course);
        tree.lesson(lessonId).orElseThrow(() -> new CustomException(ErrorCode.LESSON_NOT_FOUND));
        var enrollment = enrollment(reader, course);
        CourseVersionLesson vl =
                versionLessons.findInVersion(tree.version().getId(), lessonId)
                        .orElseThrow(() -> new CustomException(ErrorCode.LESSON_NOT_FOUND));
        if (!vl.isPreview() && enrollment.isEmpty()) {
            if (reader != null && !reader.canLearn(course)) throw new CustomException(ErrorCode.ACCESS_DENIED);
            throw new CustomException(ErrorCode.LESSON_PREVIEW_ONLY);
        }
        CourseProgressResponse learning = null;
        if (enrollment.isPresent()) {
            enrollments.touch(enrollment.get().getId(), lessonId);
            learning = learning(reader.id(), course, tree, lessonId);
        }
        var lesson = new PublishedLessonResponse.Lesson(
                lessonId,
                vl.getVersionChapter().getChapter().getId(),
                vl.getTitle(),
                vl.getSummary(),
                vl.getContent(),
                vl.getVideoId() == null ? null : new LessonResponse.Video(vl.getVideoProvider(), vl.getVideoId()),
                vl.getPosition(),
                vl.isPreview());
        return new PublishedLessonResponse(
                course.getId(), tree.version().getTitle(), lesson, curriculum(tree), viewer(reader, course, enrollment), learning);
    }

    @Override
    @Transactional
    public CourseProgressResponse start(UUID actor, UUID id) {
        Reader reader = reader(actor);
        Course course = visible(id);
        if (!reader.canLearn(course)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        enrollments.insertFree(actor, id);
        var enrollment = enrollments.findActive(actor, id).orElseThrow();
        return learning(actor, course, tree(course), enrollment.getLastLessonId());
    }

    @Override
    @Transactional
    public CourseProgressResponse completion(UUID actor, UUID courseId, UUID lessonId, boolean completed) {
        Reader reader = reader(actor);
        // Lock before loading so the visibility check and the snapshot see any approve/hide that just committed.
        courses.findByIdForShare(courseId);
        Course course = visible(courseId);
        if (!reader.canLearn(course)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        Tree tree = tree(course);
        tree.lesson(lessonId).orElseThrow(() -> new CustomException(ErrorCode.LESSON_NOT_FOUND));
        var enrollment =
                enrollments.findActive(actor, courseId)
                        .orElseThrow(() -> new CustomException(ErrorCode.COURSE_ENROLLMENT_REQUIRED));
        if (completed) progress.complete(actor, lessonId);
        else progress.uncomplete(actor, lessonId);
        return learning(actor, course, tree, enrollment.getLastLessonId());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<MyCourseResponse> myCourses(UUID actor, int page, int size) {
        var pageable = PageRequest.of(page, size);
        // Managers never count as enrolled (same rule as detail and lesson).
        if (reader(actor).manager()) return PageResponse.from(Page.empty(pageable), List.of());
        // Unsorted on purpose: the specification orders by last access (nulls last), then grant.
        var result = enrollments.findAll(CourseSpecification.myCourses(actor), pageable);
        var versionIds = result.stream().map(e -> e.getCourse().getPublishedVersion().getId()).toList();
        var tags = tags(versionIds);
        var rowsByVersion = new HashMap<UUID, List<CourseLessonRow>>();
        if (!versionIds.isEmpty())
            versionLessons.findRows(versionIds)
                    .forEach(r -> rowsByVersion.computeIfAbsent(r.versionId(), k -> new ArrayList<>()).add(r));
        var allLessons = rowsByVersion.values().stream().flatMap(List::stream).map(CourseLessonRow::lessonId).toList();
        Set<UUID> done = allLessons.isEmpty() ? Set.of() : progress.findCompleted(actor, allLessons);
        return PageResponse.from(
                result,
                result.stream()
                        .map(e -> {
                            var course = e.getCourse();
                            var rows = rowsByVersion.getOrDefault(course.getPublishedVersion().getId(), List.of());
                            int completed = (int) rows.stream().filter(r -> done.contains(r.lessonId())).count();
                            var next = continueRow(rows, e.getLastLessonId());
                            return new MyCourseResponse(
                                    PublishedCourseSummaryResponse.from(
                                            course, tags.getOrDefault(course.getPublishedVersion().getId(), List.of())),
                                    Progress.of(completed, rows.size()),
                                    next == null ? null : new ContinueLesson(next.lessonId(), next.title(), next.chapterId()),
                                    e.getGrantedAt(),
                                    e.getLastAccessedAt());
                        })
                        .toList());
    }

    // ------------------------------------------------------------------ helpers

    private Reader reader(UUID actor) {
        if (actor == null) return null;
        User user = users.findWithRolesById(actor).orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        if (!user.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
        boolean manager = user.getUserRoles().stream()
                .anyMatch(link -> link.getRole().getName() == RoleName.MODERATOR || link.getRole().getName() == RoleName.ADMIN);
        return new Reader(actor, manager);
    }

    private Course visible(UUID id) {
        return courses.findOne(CourseSpecification.visibleCourse().and((root, q, cb) -> cb.equal(root.get("id"), id)))
                .orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
    }

    /** Managers and owners never count as enrolled, even if a row exists. */
    private Optional<CourseEnrollment> enrollment(Reader reader, Course course) {
        if (reader == null || !reader.canLearn(course)) return Optional.empty();
        return enrollments.findActive(reader.id(), course.getId());
    }

    private static Viewer viewer(Reader reader, Course course, Optional<CourseEnrollment> enrollment) {
        return new Viewer(enrollment.isPresent(), reader == null || reader.canLearn(course));
    }

    private Tree tree(Course course) {
        var v = course.getPublishedVersion();
        return new Tree(v, v.getChapters(), versionLessons.findRows(List.of(v.getId())));
    }

    private static List<PublishedCourseDetailResponse.Chapter> curriculum(Tree tree) {
        return tree.chapters().stream()
                .map(vc -> new PublishedCourseDetailResponse.Chapter(
                        vc.getChapter().getId(),
                        vc.getTitle(),
                        vc.getPosition(),
                        tree.rows().stream()
                                .filter(r -> r.versionChapterId().equals(vc.getId()))
                                .map(r -> new PublishedCourseDetailResponse.LessonItem(
                                        r.lessonId(), r.title(), r.summary(), r.position(), r.preview(), r.hasVideo(), r.hasContent()))
                                .toList()))
                .toList();
    }

    private CourseProgressResponse learning(UUID user, Course course, Tree tree, UUID lastLessonId) {
        var ids = tree.rows().stream().map(CourseLessonRow::lessonId).toList();
        Set<UUID> done = ids.isEmpty() ? Set.of() : progress.findCompleted(user, ids);
        var chapters = tree.chapters().stream()
                .map(vc -> {
                    var rows = tree.rows().stream().filter(r -> r.versionChapterId().equals(vc.getId())).toList();
                    var p = Progress.of((int) rows.stream().filter(r -> done.contains(r.lessonId())).count(), rows.size());
                    return new ChapterProgress(vc.getChapter().getId(), p.completed(), p.total(), p.percent());
                })
                .toList();
        var completed = ids.stream().filter(done::contains).toList();
        var next = continueRow(tree.rows(), lastLessonId);
        return new CourseProgressResponse(
                course.getId(),
                Progress.of(completed.size(), ids.size()),
                chapters,
                completed,
                next == null ? null : new ContinueLesson(next.lessonId(), next.title(), next.chapterId()));
    }

    /** Last opened lesson if the current snapshot still has it, otherwise the first lesson. */
    private static CourseLessonRow continueRow(List<CourseLessonRow> rows, UUID lastLessonId) {
        if (rows.isEmpty()) return null;
        return rows.stream().filter(r -> r.lessonId().equals(lastLessonId)).findFirst().orElse(rows.get(0));
    }

    private Map<UUID, List<ArticleTaxonomyResponse>> tags(Collection<UUID> versionIds) {
        var result = new HashMap<UUID, List<ArticleTaxonomyResponse>>();
        if (versionIds.isEmpty()) return result;
        for (Object[] row : versions.findTagRows(versionIds))
            result.computeIfAbsent((UUID) row[0], k -> new ArrayList<>())
                    .add(new ArticleTaxonomyResponse((UUID) row[1], (String) row[2]));
        return result;
    }
}
