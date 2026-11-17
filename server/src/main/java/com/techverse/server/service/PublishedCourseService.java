package com.techverse.server.service;

import com.techverse.server.dto.request.ArticleOptionsFilter;
import com.techverse.server.dto.request.PublishedCourseFilter;
import com.techverse.server.dto.response.*;

import java.util.UUID;

/** Reader side of free courses; {@code actor} is null for guests on public reads. */
public interface PublishedCourseService {
    PageResponse<PublishedCourseSummaryResponse> list(UUID actor, PublishedCourseFilter filter);

    PublishedCourseDetailResponse detail(UUID actor, UUID id);

    /** Topics and tags of visible course snapshots; anonymous. */
    PublishedArticleOptionsResponse options(ArticleOptionsFilter filter);

    PublishedLessonResponse lesson(UUID actor, UUID courseId, UUID lessonId);

    /** Snapshot text the AI tutor may use; same access rule as {@link #lesson} but never enrolls or touches progress. */
    TutorLesson tutorLesson(UUID actor, UUID courseId, UUID lessonId);

    record TutorLesson(String courseTitle, String title, String summary, String content) {}

    CourseProgressResponse start(UUID actor, UUID id);

    CourseProgressResponse completion(UUID actor, UUID courseId, UUID lessonId, boolean completed);

    PageResponse<MyCourseResponse> myCourses(UUID actor, int page, int size);
}
