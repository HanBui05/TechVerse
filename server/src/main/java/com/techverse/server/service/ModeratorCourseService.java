package com.techverse.server.service;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;

import java.util.UUID;

public interface ModeratorCourseService {
    PageResponse<ModeratorCourseSummaryResponse> list(UUID actor, ModeratorArticleFilter filter);

    ModeratorCourseDetailResponse detail(UUID actor, UUID id);

    PageResponse<CourseModerationHistoryResponse> history(UUID actor, UUID id, int page, int size);

    LessonResponse lesson(UUID actor, UUID id, UUID lessonId, UUID versionId);

    ModeratorCourseDetailResponse review(UUID actor, UUID id, ReviewArticleRequest request);

    ModeratorCourseDetailResponse publication(UUID actor, UUID id, ArticlePublicationRequest request);
}
