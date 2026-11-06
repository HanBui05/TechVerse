package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.CourseCreationReceipt;
import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.CourseCreationRepository.Kind;
import com.techverse.server.repository.specification.CourseSpecification;
import com.techverse.server.service.AuthorCourseService;
import com.techverse.server.service.impl.ArticleImageService.Target;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.function.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthorCourseServiceImpl implements AuthorCourseService {
    /** Positions move here first: unique position indexes are not deferrable. */
    private static final int SHIFT = 1_000_000;

    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final CourseVersionLessonRepository versionLessons;
    private final CourseModerationHistoryRepository histories;
    private final TopicRepository topics;
    private final TagRepository tags;
    private final CourseAccessService access;
    private final LessonContentService content;
    private final ArticleImageService images;
    private final ArticleRateLimitService limits;
    private final CourseCreationRepository receipts;
    private final AiCompletedGenerationRepository aiGenerations;
    private final PlatformTransactionManager transactionManager;
    private final EntityManager em;
    private final ObjectMapper mapper;

    // ------------------------------------------------------------------ course

    @Override
    public CourseResponse create(UUID actor, UUID key, CourseWriteRequest request) {
        String fingerprint = digest(courseFingerprintFields(request));
        CourseResponse result =
                transaction()
                        .execute(
                                s -> {
                                    User author = access.lockWriter(actor);
                                    var replay =
                                            replay(Kind.COURSE, receipts.find(Kind.COURSE, actor, key), fingerprint,
                                                    ErrorCode.COURSE_KEY_CONFLICT, courses::existsById, CourseResponse.class);
                                    if (replay != null) return replay;
                                    if (request.getTitle() == null || request.getTopicId() == null) invalid();
                                    if (request.getCoverImageUrl() != null)
                                        throw new CustomException(ErrorCode.COURSE_IMAGE_INVALID);
                                    // A new course has no chapter yet.
                                    if (request.getAction() == ArticleAction.SUBMIT)
                                        throw new CustomException(ErrorCode.COURSE_NOT_READY);
                                    Topic topic = lockTopic(request.getTopicId());
                                    if (!topic.isActive()) inactive();
                                    List<Tag> selected = lockTags(request.getTagIds() == null ? List.of() : request.getTagIds());
                                    if (selected.stream().anyMatch(t -> !t.isActive())) inactive();
                                    Course course =
                                            Course.builder()
                                                    .author(author)
                                                    .topic(topic)
                                                    .title(request.getTitle())
                                                    .summary(Objects.requireNonNullElse(request.getSummary(), ""))
                                                    .description(Objects.requireNonNullElse(request.getDescription(), ""))
                                                    .level(level(request.getLevel(), CourseLevel.BEGINNER))
                                                    .build();
                                    content.validateDescription(course.getDescription(), null);
                                    course.replaceTags(selected);
                                    course.save();
                                    courses.saveAndFlush(course);
                                    em.refresh(course);
                                    CourseResponse response = toResponse(course);
                                    // Stored BEFORE commit: a retry after an unknown outcome finds it.
                                    receipts.save(Kind.COURSE, actor, key,
                                            new CourseCreationReceipt(fingerprint, course.getId(), json(response), false));
                                    return response;
                                });
        complete(Kind.COURSE, actor, key, fingerprint, result.id(), result);
        return result;
    }

    @Override
    public CourseResponse update(UUID actor, UUID id, CourseWriteRequest request) {
        if (request.getAction() == ArticleAction.SAVE) {
            if (request.getProvided().isEmpty()) invalid();
            return transaction()
                    .execute(
                            s -> {
                                access.lockWriter(actor);
                                Course course = access.lockEditable(actor, id);
                                applyEdits(course, request);
                                String cover = course.getCoverImageUrl();
                                if (cover != null && !images.isOwnManagedUrl(cover, Target.course(actor, id)))
                                    throw new CustomException(ErrorCode.COURSE_IMAGE_INVALID);
                                course.save();
                                return flushed(course);
                            });
        }
        return submit(actor, id, request);
    }

    /**
     * Provider checks run without locks for documents changed since the published version; the
     * locked phase re-derives that set and retries if it now holds an unverified image.
     */
    private CourseResponse submit(UUID actor, UUID id, CourseWriteRequest request) {
        var verified = new HashSet<ImageRef>();
        for (int attempt = 0; attempt < 3; attempt++) {
            var readOnly = transaction();
            readOnly.setReadOnly(true);
            List<ImageRef> pending =
                    readOnly.execute(
                            s -> {
                                Course course = access.owned(actor, id);
                                String description = request.has("description") ? request.getDescription() : course.getDescription();
                                String cover = request.has("coverImageUrl") ? request.getCoverImageUrl() : course.getCoverImageUrl();
                                return changedImages(course, description, cover);
                            });
            for (ImageRef ref : pending) {
                if (verified.contains(ref)) continue;
                checkLive(ref);
                verified.add(ref);
            }
            CourseResponse result =
                    transaction()
                            .execute(
                                    s -> {
                                        access.lockWriter(actor);
                                        Course course = access.lockEditable(actor, id);
                                        applyEdits(course, request);
                                        if (course.getSummary().isBlank() || course.getDescription().isBlank())
                                            throw new CustomException(ErrorCode.COURSE_NOT_READY);
                                        for (ImageRef ref : allImages(course))
                                            if (!images.isOwnManagedUrl(ref.url(), ref.target()))
                                                throw new CustomException(ErrorCode.COURSE_NOT_READY);
                                        var changed = changedImages(course, course.getDescription(), course.getCoverImageUrl());
                                        if (!verified.containsAll(changed)) {
                                            s.setRollbackOnly();
                                            return null;
                                        }
                                        // Cleanup deletes under this same course lock: re-read each
                                        // changed image so one removed after the pre-check fails here.
                                        for (ImageRef ref : changed) checkLive(ref);
                                        if (!course.getTopic().isActive()
                                                || course.getCourseTags().stream().anyMatch(t -> !t.getTag().isActive()))
                                            inactive();
                                        course.submit();
                                        return flushed(course);
                                    });
            if (result != null) return result;
        }
        throw new CustomException(ErrorCode.COURSE_REQUEST_IN_PROGRESS);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse withdraw(UUID actor, UUID id) {
        access.lockWriter(actor);
        Course course = access.lockOwned(actor, id);
        course.withdraw();
        return flushed(course);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse discard(UUID actor, UUID id) {
        access.lockWriter(actor);
        Course course = access.lockOwned(actor, id);
        tombstoneRemovedLessons(course, () -> {
            course.shiftActivePositions(SHIFT);
            em.flush();
            course.discard();
        });
        return flushed(course);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse publication(UUID actor, UUID id, ArticlePublicationRequest request) {
        var action = request.action();
        if (action != ArticlePublicationAction.HIDE && action != ArticlePublicationAction.UNHIDE) invalid();
        User user = access.lockWriter(actor);
        Course course = access.lockOwned(actor, id);
        histories.save(action == ArticlePublicationAction.HIDE ? course.authorHide(user) : course.authorUnhide(user));
        return flushed(course);
    }

    @Override
    @Transactional(timeout = 45)
    public void delete(UUID actor, UUID id) {
        User user = access.lockActiveUser(actor);
        Course course = access.lockOwned(actor, id);
        if (course.isHardDeletable()) {
            // Tombstone first: if Redis is down the delete aborts instead of allowing resurrection.
            receipts.markDeleted(Kind.COURSE, id);
            courses.delete(course);
        } else {
            histories.save(course.softDelete(user));
        }
        courses.flush();
    }

    @Override
    @Transactional(readOnly = true)
    public CourseResponse detail(UUID actor, UUID id) {
        return toResponse(access.owned(actor, id));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CourseSummaryResponse> list(UUID actor, ArticleFilter filter) {
        access.checkReader(actor);
        Sort sort =
                Sort.by(filter.getDirection(), filter.getSortBy().getProperty())
                        .and(Sort.by(filter.getDirection(), "id"));
        // shortcut: hasUnpublishedChanges loads each published version (N+1 per page of <=100); add a
        // published-fingerprint formula like Article if lists get slow.
        var page = courses.findAll(CourseSpecification.filter(actor, filter), PageRequest.of(filter.getPage(), filter.getSize(), sort));
        return PageResponse.from(page, page.stream().map(CourseSummaryResponse::from).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<CourseModerationHistoryResponse> history(UUID actor, UUID id, int page, int size) {
        access.owned(actor, id);
        var result = histories.findPage(id, PageRequest.of(page, size));
        return PageResponse.from(result, result.stream().map(CourseModerationHistoryResponse::from).toList());
    }

    @Override
    public ArticleImportResponse importFile(UUID actor, MultipartFile file) {
        transaction().executeWithoutResult(s -> access.lockWriter(actor));
        CourseErrors.run(false, () -> limits.check(actor, false));
        return content.importFile(file);
    }

    @Override
    public ArticleImageResponse uploadCourseImage(UUID actor, UUID id, UUID key, MultipartFile file) {
        return CourseErrors.call(true, () -> images.upload(Target.course(actor, id), key, file, () -> {
            access.lockWriter(actor);
            access.lockEditable(actor, id);
        }));
    }

    @Override
    public ArticleImageResponse uploadLessonImage(UUID actor, UUID id, UUID lessonId, UUID key, MultipartFile file) {
        return CourseErrors.call(true, () -> images.upload(Target.lesson(actor, lessonId, id), key, file, () -> {
            access.lockWriter(actor);
            activeLesson(access.lockEditable(actor, id), lessonId);
        }));
    }

    // ------------------------------------------------------------------ chapters

    @Override
    @Transactional(timeout = 45)
    public CourseResponse addChapter(UUID actor, UUID id, CourseChapterRequest request) {
        access.lockWriter(actor);
        Course course = access.lockEditable(actor, id);
        var active = course.activeChapters();
        course.addChapter(request.title(), active.isEmpty() ? 1 : active.getLast().getPosition() + 1);
        em.flush(); // the fingerprint holds chapter IDs
        course.save();
        return flushed(course);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse editChapter(UUID actor, UUID id, UUID chapterId, CourseChapterRequest request) {
        access.lockWriter(actor);
        Course course = access.lockEditable(actor, id);
        course.editChapter(activeChapter(course, chapterId), request.title());
        course.save();
        return flushed(course);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse deleteChapter(UUID actor, UUID id, UUID chapterId) {
        access.lockWriter(actor);
        Course course = access.lockEditable(actor, id);
        CourseChapter chapter = activeChapter(course, chapterId);
        tombstoneRemovedLessons(course, () -> course.removeChapter(chapter));
        em.flush();
        course.save();
        return flushed(course);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse reorderChapters(UUID actor, UUID id, CourseReorderRequest request) {
        access.lockWriter(actor);
        Course course = access.lockEditable(actor, id);
        course.reorderChapters(request.ids(), SHIFT);
        em.flush();
        course.reorderChapters(request.ids(), 0);
        em.flush();
        course.save();
        return flushed(course);
    }

    // ------------------------------------------------------------------ lessons

    @Override
    public LessonResponse createLesson(UUID actor, UUID id, UUID chapterId, UUID key, LessonWriteRequest request) {
        var fields = lessonFingerprintFields(request);
        fields.add(id.toString());
        fields.add(chapterId.toString());
        String fingerprint = digest(fields);
        LessonResponse result =
                transaction()
                        .execute(
                                s -> {
                                    access.lockWriter(actor);
                                    Course course = access.lockOwned(actor, id);
                                    var replay =
                                            replay(Kind.LESSON, receipts.find(Kind.LESSON, actor, key), fingerprint,
                                                    request.getAiGenerationId() == null
                                                            ? ErrorCode.COURSE_KEY_CONFLICT
                                                            : ErrorCode.AI_GENERATION_INVALID,
                                                    lessons::existsById, LessonResponse.class);
                                    if (replay != null) return replay;
                                    course.ensureEditable();
                                    CourseChapter chapter = activeChapter(course, chapterId);
                                    if (request.getTitle() == null) invalid();
                                    content.validateLesson(request.getContent());
                                    if (request.getAiGenerationId() != null)
                                        // Lesson ID is generated at flush, so the retry-stable claim is the request key; separate
                                        // namespaces stop a client key equal to a lesson ID from matching a PATCH claim.
                                        claim(actor, course, request.getAiGenerationId(), request.getTitle(),
                                                request.getSummary(), request.getContent(), "LESSON_CREATE:" + key);
                                    var active = chapter.activeLessons();
                                    Lesson lesson = course.addLesson(chapter, request.getTitle(), request.getSummary(),
                                            request.getContent(), request.getVideoUrl(),
                                            Boolean.TRUE.equals(request.getPreview()),
                                            active.isEmpty() ? 1 : active.getLast().getPosition() + 1);
                                    if (request.getAiGenerationId() != null) lesson.markAiAssisted();
                                    em.flush();
                                    course.save();
                                    LessonResponse response = flushed(course, lesson);
                                    receipts.save(Kind.LESSON, actor, key,
                                            new CourseCreationReceipt(fingerprint, lesson.getId(), json(response), false));
                                    return response;
                                });
        complete(Kind.LESSON, actor, key, fingerprint, result.id(), result);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public LessonResponse lesson(UUID actor, UUID id, UUID lessonId, UUID versionId) {
        Course course = access.owned(actor, id);
        var target = Target.lesson(actor, lessonId, id);
        if (versionId == null) {
            Lesson lesson = activeLesson(course, lessonId);
            return LessonResponse.from(lesson, issues(lesson.getContent(), target));
        }
        var snapshot =
                versionLessons.findInVersion(versionId, lessonId)
                        .filter(vl -> vl.getVersion().getCourse().getId().equals(id))
                        .orElseThrow(() -> new CustomException(ErrorCode.LESSON_NOT_FOUND));
        return LessonResponse.from(snapshot, issues(snapshot.getContent(), target));
    }

    @Override
    @Transactional(timeout = 45)
    public LessonResponse updateLesson(UUID actor, UUID id, UUID lessonId, LessonWriteRequest request) {
        if (request.getProvided().isEmpty()) invalid();
        access.lockWriter(actor);
        Course course = access.lockEditable(actor, id);
        Lesson lesson = activeLesson(course, lessonId);
        String title = request.has("title") ? request.getTitle() : lesson.getTitle();
        String summary = request.has("summary") ? request.getSummary() : lesson.getSummary();
        String text = request.has("content") ? request.getContent() : lesson.getContent();
        String video =
                request.has("videoUrl")
                        ? request.getVideoUrl()
                        : lesson.getVideoId() == null ? null : "https://youtu.be/" + lesson.getVideoId();
        boolean preview = request.has("preview") ? request.getPreview() : lesson.isPreview();
        content.validateLesson(text);
        if (request.getAiGenerationId() != null)
            claim(actor, course, request.getAiGenerationId(), title, summary, text, "LESSON_UPDATE:" + lessonId);
        lesson.edit(title, summary, text, video, preview);
        if (request.getAiGenerationId() != null) lesson.markAiAssisted();
        course.save();
        return flushed(course, lesson);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse deleteLesson(UUID actor, UUID id, UUID lessonId) {
        access.lockWriter(actor);
        Course course = access.lockEditable(actor, id);
        Lesson lesson = activeLesson(course, lessonId);
        tombstoneRemovedLessons(course, () -> course.removeLesson(lesson));
        em.flush();
        course.save();
        return flushed(course);
    }

    @Override
    @Transactional(timeout = 45)
    public CourseResponse reorderLessons(UUID actor, UUID id, UUID chapterId, CourseReorderRequest request) {
        access.lockWriter(actor);
        Course course = access.lockEditable(actor, id);
        CourseChapter chapter = activeChapter(course, chapterId);
        course.reorderLessons(chapter, request.ids(), SHIFT);
        em.flush();
        course.reorderLessons(chapter, request.ids(), 0);
        em.flush();
        course.save();
        return flushed(course);
    }

    // ------------------------------------------------------------------ helpers

    private record ImageRef(Target target, String url) {}

    private void checkLive(ImageRef ref) {
        try {
            images.validateManaged(ref.url(), ref.target());
        } catch (CustomException e) {
            if (e.getErrorCode() == ErrorCode.ARTICLE_IMAGE_INVALID)
                throw new CustomException(ErrorCode.COURSE_NOT_READY);
            throw CourseErrors.translate(e, true);
        }
    }

    /** Images of documents (course meta, lessons) that differ from the published version. */
    private List<ImageRef> changedImages(Course course, String description, String cover) {
        var refs = new ArrayList<ImageRef>();
        var owner = course.getAuthor().getId();
        var published = course.getPublishedVersion();
        if (published == null
                || !Objects.equals(published.getDescription(), description)
                || !Objects.equals(published.getCoverImageUrl(), cover))
            courseImages(refs, Target.course(owner, course.getId()), description, cover);
        var publishedLessons = new HashMap<UUID, String>();
        if (published != null)
            published.getLessons().forEach(vl -> publishedLessons.put(vl.getLesson().getId(), vl.getContentFingerprint()));
        for (Lesson lesson : course.activeLessons())
            if (!lesson.getContentFingerprint().equals(publishedLessons.get(lesson.getId())))
                lessonImages(refs, lesson);
        return refs;
    }

    private List<ImageRef> allImages(Course course) {
        var refs = new ArrayList<ImageRef>();
        courseImages(refs, Target.course(course.getAuthor().getId(), course.getId()), course.getDescription(), course.getCoverImageUrl());
        course.activeLessons().forEach(l -> lessonImages(refs, l));
        return refs;
    }

    private void courseImages(List<ImageRef> refs, Target target, String description, String cover) {
        content.imageUrls(description).forEach(url -> refs.add(new ImageRef(target, url)));
        if (cover != null) refs.add(new ImageRef(target, cover));
    }

    private void lessonImages(List<ImageRef> refs, Lesson lesson) {
        var target = Target.lesson(lesson.getCourse().getAuthor().getId(), lesson.getId(), lesson.getCourse().getId());
        content.imageUrls(lesson.getContent()).forEach(url -> refs.add(new ImageRef(target, url)));
    }

    private void applyEdits(Course course, CourseWriteRequest request) {
        UUID topicId = request.has("topicId") ? request.getTopicId() : course.getTopic().getId();
        Topic topic = lockTopic(topicId);
        if (!topic.isActive() && !topicId.equals(course.getTopic().getId())) inactive();
        List<UUID> oldTags = course.getCourseTags().stream().map(t -> t.getTag().getId()).toList();
        List<Tag> selected = lockTags(request.has("tagIds") ? request.getTagIds() : oldTags);
        if (selected.stream().anyMatch(t -> !t.isActive() && !oldTags.contains(t.getId()))) inactive();
        course.edit(
                topic,
                request.has("title") ? request.getTitle() : course.getTitle(),
                request.has("summary") ? request.getSummary() : course.getSummary(),
                request.has("description") ? request.getDescription() : course.getDescription(),
                request.has("level") ? level(request.getLevel(), null) : course.getLevel(),
                request.has("coverImageUrl") ? request.getCoverImageUrl() : course.getCoverImageUrl());
        course.replaceTags(selected);
        content.validateDescription(course.getDescription(), course.getCoverImageUrl());
    }

    /** Server-side owner check, then the receipt must match this course and draft exactly. */
    private void claim(UUID actor, Course course, UUID generation, String title, String summary, String text, String claimKey) {
        aiGenerations.claim(
                actor,
                generation,
                AiCompletedGenerationRepository.lessonFingerprint(course.getId(), title, summary, text),
                claimKey);
    }

    /** Hard-deleted lessons get a tombstone so a create retry cannot resurrect them. */
    private void tombstoneRemovedLessons(Course course, Runnable change) {
        Set<UUID> before = new HashSet<>();
        course.getChapters().forEach(ch -> ch.getLessons().forEach(l -> before.add(l.getId())));
        change.run();
        course.getChapters().forEach(ch -> ch.getLessons().forEach(l -> before.remove(l.getId())));
        before.forEach(lessonId -> receipts.markDeleted(Kind.LESSON, lessonId));
    }

    private <T> T replay(Kind kind, CourseCreationReceipt previous, String fingerprint, ErrorCode mismatch,
            Predicate<UUID> exists, Class<T> type) {
        if (previous == null) return null;
        if (!previous.fingerprint().equals(fingerprint)) throw new CustomException(mismatch);
        if (previous.resourceId() == null) return null;
        if (exists.test(previous.resourceId())) {
            if (previous.response() == null) throw new CustomException(ErrorCode.COURSE_REQUEST_IN_PROGRESS);
            return mapper.readValue(previous.response(), type);
        }
        // Missing row: rolled back (retry may create) or hard-deleted.
        if (receipts.isDeleted(kind, previous.resourceId())) throw new CustomException(ErrorCode.COURSE_KEY_CONFLICT);
        return null;
    }

    private void complete(Kind kind, UUID actor, UUID key, String fingerprint, UUID id, Object response) {
        try {
            receipts.save(kind, actor, key, new CourseCreationReceipt(fingerprint, id, json(response), true));
        } catch (CustomException e) {
            log.warn("Course creation committed; pending receipt will be recovered on retry");
        }
    }

    private static CourseChapter activeChapter(Course course, UUID chapterId) {
        return course.activeChapters().stream()
                .filter(c -> c.getId().equals(chapterId))
                .findFirst()
                .orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
    }

    private static Lesson activeLesson(Course course, UUID lessonId) {
        return course.activeLessons().stream()
                .filter(l -> l.getId().equals(lessonId))
                .findFirst()
                .orElseThrow(() -> new CustomException(ErrorCode.LESSON_NOT_FOUND));
    }

    private CourseResponse flushed(Course course) {
        courses.flush();
        // Triggers own updated_at; refresh cascades to the tree.
        em.refresh(course);
        return toResponse(course);
    }

    private LessonResponse flushed(Course course, Lesson lesson) {
        courses.flush();
        em.refresh(course);
        return LessonResponse.from(lesson, issues(lesson.getContent(), Target.lesson(course.getAuthor().getId(), lesson.getId(), course.getId())));
    }

    private CourseResponse toResponse(Course course) {
        return CourseResponse.from(
                course, issues(course.getDescription(), Target.course(course.getAuthor().getId(), course.getId())));
    }

    private List<ArticleImageIssueResponse> issues(String text, Target target) {
        return content.imageIssues(text, url -> images.isOwnManagedUrl(url, target));
    }

    private TransactionTemplate transaction() {
        var tx = new TransactionTemplate(transactionManager);
        tx.setTimeout(45);
        return tx;
    }

    private Topic lockTopic(UUID id) {
        return topics.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.TOPIC_NOT_FOUND));
    }

    private List<Tag> lockTags(List<UUID> ids) {
        if (ids.size() > 10 || new HashSet<>(ids).size() != ids.size()) invalid();
        return ids.stream()
                .sorted(Comparator.comparing(UUID::toString))
                .map(id -> tags.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.TAG_NOT_FOUND)))
                .toList();
    }

    private static CourseLevel level(String value, CourseLevel fallback) {
        return value == null ? fallback : CourseLevel.valueOf(value);
    }

    private static List<String> courseFingerprintFields(CourseWriteRequest r) {
        var fields = new ArrayList<String>();
        fields.addAll(Arrays.asList(
                String.valueOf(r.getAction()), r.getTitle(), r.getSummary(), r.getDescription(), r.getLevel(),
                r.getTopicId() == null ? null : r.getTopicId().toString(), r.getCoverImageUrl()));
        (r.getTagIds() == null ? List.<UUID>of() : r.getTagIds()).stream().map(UUID::toString).sorted().forEach(fields::add);
        return fields;
    }

    private static List<String> lessonFingerprintFields(LessonWriteRequest r) {
        return new ArrayList<>(Arrays.asList(
                r.getTitle(), r.getSummary(), r.getContent(), r.getVideoUrl(), String.valueOf(r.getPreview()),
                r.getAiGenerationId() == null ? null : r.getAiGenerationId().toString()));
    }

    private static String digest(List<String> fields) {
        // Same length-prefixed SHA-256 as content fingerprints; null differs from empty.
        var out = new java.io.ByteArrayOutputStream();
        for (String field : fields) {
            byte[] bytes = field == null ? new byte[0] : field.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            out.writeBytes(java.nio.ByteBuffer.allocate(4).putInt(field == null ? -1 : bytes.length).array());
            out.writeBytes(bytes);
        }
        return AiCompletedGenerationRepository.sha256(HexFormat.of().formatHex(out.toByteArray()));
    }

    private String json(Object value) {
        return mapper.writeValueAsString(value);
    }

    private static void invalid() {
        throw new CustomException(ErrorCode.VALIDATION_ERROR);
    }

    private static void inactive() {
        throw new CustomException(ErrorCode.COURSE_TAXONOMY_INACTIVE);
    }
}
