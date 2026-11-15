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

    CourseProgressResponse start(UUID actor, UUID id);

    CourseProgressResponse completion(UUID actor, UUID courseId, UUID lessonId, boolean completed);

    PageResponse<MyCourseResponse> myCourses(UUID actor, int page, int size);
}
