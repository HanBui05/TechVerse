package com.techverse.server.repository.specification;

import com.techverse.server.dto.request.ArticleFilter;
import com.techverse.server.entity.Article;
import com.techverse.server.entity.ArticleTag;

import org.springframework.data.jpa.domain.Specification;

import java.util.Locale;
import java.util.UUID;

public final class ArticleSpecification {
    private ArticleSpecification() {}

    public static Specification<Article> filter(UUID owner, ArticleFilter f) {
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("author").get("id"), owner));
            if (f.getStatus() != null) predicates.add(cb.equal(root.get("status"), f.getStatus()));
            if (f.getTopicId() != null)
                predicates.add(cb.equal(root.get("topic").get("id"), f.getTopicId()));
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
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
