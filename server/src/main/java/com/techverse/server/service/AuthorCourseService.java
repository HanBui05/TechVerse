package com.techverse.server.service;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;

import org.springframework.web.multipart.MultipartFile;

import java.util.*;

public interface AuthorCourseService {
    CourseResponse create(UUID actor, UUID key, CourseWriteRequest request);

    CourseResponse update(UUID actor, UUID id, CourseWriteRequest request);

    CourseResponse withdraw(UUID actor, UUID id);

    CourseResponse discard(UUID actor, UUID id);

    CourseResponse publication(UUID actor, UUID id, ArticlePublicationRequest request);

    void delete(UUID actor, UUID id);

    CourseResponse detail(UUID actor, UUID id);

    PageResponse<CourseSummaryResponse> list(UUID actor, ArticleFilter filter);

    PageResponse<CourseModerationHistoryResponse> history(UUID actor, UUID id, int page, int size);

    ArticleImportResponse importFile(UUID actor, MultipartFile file);

    ArticleImageResponse uploadCourseImage(UUID actor, UUID id, UUID key, MultipartFile file);

    ArticleImageResponse uploadLessonImage(UUID actor, UUID id, UUID lessonId, UUID key, MultipartFile file);

    CourseResponse addChapter(UUID actor, UUID id, CourseChapterRequest request);

    CourseResponse editChapter(UUID actor, UUID id, UUID chapterId, CourseChapterRequest request);

    CourseResponse deleteChapter(UUID actor, UUID id, UUID chapterId);

    CourseResponse reorderChapters(UUID actor, UUID id, CourseReorderRequest request);

    LessonResponse createLesson(UUID actor, UUID id, UUID chapterId, UUID key, LessonWriteRequest request);

    LessonResponse lesson(UUID actor, UUID id, UUID lessonId, UUID versionId);

    LessonResponse updateLesson(UUID actor, UUID id, UUID lessonId, LessonWriteRequest request);

    CourseResponse deleteLesson(UUID actor, UUID id, UUID lessonId);

    CourseResponse reorderLessons(UUID actor, UUID id, UUID chapterId, CourseReorderRequest request);
}
