package com.techverse.server.dto.response;

import com.techverse.server.enums.CourseLevel;

import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Current snapshot with its curriculum (no lesson Markdown). {@code learning} is set only for an
 * enrolled learner; owners and managers read like guests ({@code canStart=false}).
 */
@Builder
public record PublishedCourseDetailResponse(
        UUID id,
        String title,
        String summary,
        String description,
        String coverImageUrl,
        CourseLevel level,
        ArticleTaxonomyResponse topic,
        List<ArticleTaxonomyResponse> tags,
        PublishedArticleAuthorResponse author,
        int versionNumber,
        Instant publishedAt,
        Instant updatedAt,
        int chapterCount,
        int lessonCount,
        List<Chapter> chapters,
        Viewer viewer,
        CourseProgressResponse learning) {
    public record Chapter(UUID id, String title, int position, List<LessonItem> lessons) {}

    public record LessonItem(
            UUID id, String title, String summary, int position, boolean preview, boolean hasVideo, boolean hasContent) {}

    public record Viewer(boolean enrolled, boolean canStart) {}
}
