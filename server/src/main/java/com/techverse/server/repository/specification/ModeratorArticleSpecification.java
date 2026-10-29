package com.techverse.server.repository.specification;

import com.techverse.server.dto.request.ModeratorArticleFilter;
import com.techverse.server.entity.Article;
import com.techverse.server.entity.ArticleTag;
import com.techverse.server.enums.ArticleStatus;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.Locale;
import java.util.UUID;

public final class ModeratorArticleSpecification {
    private ModeratorArticleSpecification() {}

    public static Specification<Article> filter(ModeratorArticleFilter f) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(cb.notEqual(root.get("status"), ArticleStatus.DRAFT));
            if (f.getStatus() != null) predicates.add(cb.equal(root.get("status"), f.getStatus()));
            if (f.getAuthorId() != null)
                predicates.add(cb.equal(root.get("author").get("id"), f.getAuthorId()));
            if (f.getTopicId() != null)
                predicates.add(cb.equal(root.get("topic").get("id"), f.getTopicId()));
            if (f.getCreatedFrom() != null)
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), f.getCreatedFrom()));
            if (f.getCreatedTo() != null)
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), f.getCreatedTo()));
            if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
                String literal =
                        f.getKeyword()
                                .strip()
                                .toLowerCase(Locale.ROOT)
                                .replace("\\", "\\\\")
                                .replace("%", "\\%")
                                .replace("_", "\\_");
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + literal + "%", '\\'));
            }
            if (f.getTagId() != null) {
                var sub = query.subquery(UUID.class);
                var link = sub.from(ArticleTag.class);
                sub.select(link.get("id"))
                        .where(
                                cb.equal(link.get("article"), root),
                                cb.equal(link.get("tag").get("id"), f.getTagId()));
                predicates.add(cb.exists(sub));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
