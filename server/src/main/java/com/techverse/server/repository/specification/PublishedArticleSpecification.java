package com.techverse.server.repository.specification;

import com.techverse.server.dto.request.PublishedArticleFilter;
import com.techverse.server.entity.Article;
import com.techverse.server.entity.ArticleTag;
import com.techverse.server.enums.ArticleStatus;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;

public final class PublishedArticleSpecification {
    /** Prevent instantiation of this specification utility. */
    private PublishedArticleSpecification() {}

    /** Enforce publication and combine reader-selected title/topic/tag filters using AND. */
    public static Specification<Article> filter(PublishedArticleFilter filter) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("status"), ArticleStatus.PUBLISHED));
            if (filter.getTopicId() != null)
                predicates.add(cb.equal(root.get("topic").get("id"), filter.getTopicId()));
            if (filter.getKeyword() != null && !filter.getKeyword().isBlank())
                predicates.add(
                        cb.like(
                                cb.lower(root.get("title")),
                                literalPattern(filter.getKeyword()),
                                '\\'));
            if (filter.getTagId() != null) {
                var subquery = query.subquery(UUID.class);
                var link = subquery.from(ArticleTag.class);
                subquery.select(link.get("id"))
                        .where(
                                cb.equal(link.get("article"), root),
                                cb.equal(link.get("tag").get("id"), filter.getTagId()));
                predicates.add(cb.exists(subquery));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /** Escape SQL LIKE metacharacters so keywords are literal, case-insensitive substrings. */
    public static String literalPattern(String keyword) {
        return "%"
                + keyword.strip()
                        .toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\")
                        .replace("%", "\\%")
                        .replace("_", "\\_")
                + "%";
    }
}
