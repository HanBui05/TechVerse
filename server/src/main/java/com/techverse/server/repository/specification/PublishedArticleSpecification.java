package com.techverse.server.repository.specification;

import com.techverse.server.dto.request.PublishedArticleFilter;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;

import jakarta.persistence.criteria.*;

import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;

/** Reader predicates over {@code Article a} joined to its current snapshot {@code v}. */
public final class PublishedArticleSpecification {
    private PublishedArticleSpecification() {}

    /**
     * Visible = publication PUBLISHED, author account active and AuthorProfile not SUSPENDED.
     * Derived in SQL so suspension/restore never rewrites status or history.
     */
    public static Predicate visible(Root<Article> a, AbstractQuery<?> query, CriteriaBuilder cb) {
        var suspended = query.subquery(UUID.class);
        var profile = suspended.from(AuthorProfile.class);
        suspended
                .select(profile.get("id"))
                .where(
                        cb.equal(profile.get("user"), a.get("author")),
                        cb.equal(profile.get("status"), AuthorProfileStatus.SUSPENDED));
        return cb.and(
                cb.equal(a.get("publicationStatus"), ArticlePublicationStatus.PUBLISHED),
                cb.isTrue(a.get("author").get("active")),
                cb.not(cb.exists(suspended)));
    }

    /** Visibility plus reader filters on snapshot title/topic/tag combined with AND. */
    public static Predicate filter(
            PublishedArticleFilter filter,
            Root<Article> a,
            Join<Article, ArticlePublicationVersion> v,
            CriteriaQuery<?> query,
            CriteriaBuilder cb) {
        var predicates = new ArrayList<Predicate>();
        predicates.add(visible(a, query, cb));
        if (filter.getTopicId() != null)
            predicates.add(cb.equal(v.get("topic").get("id"), filter.getTopicId()));
        if (filter.getKeyword() != null && !filter.getKeyword().isBlank())
            predicates.add(
                    cb.like(cb.lower(v.get("title")), literalPattern(filter.getKeyword()), '\\'));
        if (filter.getTagId() != null) {
            var subquery = query.subquery(UUID.class);
            var link = subquery.from(ArticlePublicationVersionTag.class);
            subquery.select(link.get("id"))
                    .where(
                            cb.equal(link.get("version"), v),
                            cb.equal(link.get("tag").get("id"), filter.getTagId()));
            predicates.add(cb.exists(subquery));
        }
        return cb.and(predicates.toArray(Predicate[]::new));
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
