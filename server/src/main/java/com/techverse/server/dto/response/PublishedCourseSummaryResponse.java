package com.techverse.server.dto.response;

import com.techverse.server.entity.Course;
import com.techverse.server.entity.CoursePublicationVersion;
import com.techverse.server.enums.CourseLevel;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Reader card built from the current snapshot only ({@code updatedAt} is its approval time), except
 * the price, which is live on the course.
 */
public record PublishedCourseSummaryResponse(
        UUID id,
        String title,
        String summary,
        String coverImageUrl,
        CourseLevel level,
        long priceAmount,
        String currency,
        ArticleTaxonomyResponse topic,
        List<ArticleTaxonomyResponse> tags,
        ArticleAuthorResponse author,
        Instant publishedAt,
        Instant updatedAt) {
    public static PublishedCourseSummaryResponse from(Course c, List<ArticleTaxonomyResponse> tags) {
        CoursePublicationVersion v = c.getPublishedVersion();
        var author = c.getAuthor();
        return new PublishedCourseSummaryResponse(
                c.getId(),
                v.getTitle(),
                v.getSummary(),
                v.getCoverImageUrl(),
                v.getLevel(),
                c.getPriceAmount(),
                "VND",
                new ArticleTaxonomyResponse(v.getTopic().getId(), v.getTopic().getName()),
                tags,
                new ArticleAuthorResponse(author.getId(), author.getFullName(), author.getAvatarUrl()),
                c.getPublishedAt(),
                v.getApprovedAt());
    }
}
