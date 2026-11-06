package com.techverse.server.repository.specification;

import com.techverse.server.dto.request.ArticleFilter;
import com.techverse.server.entity.Course;
import com.techverse.server.entity.CourseTag;
import com.techverse.server.enums.ArticlePublicationStatus;

import org.springframework.data.jpa.domain.Specification;

import java.util.Locale;
import java.util.UUID;

/** Author workspace filter; same rules as {@link ArticleSpecification}. */
public final class CourseSpecification {
    private CourseSpecification() {}

    public static Specification<Course> filter(UUID owner, ArticleFilter f) {
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("author").get("id"), owner));
            predicates.add(cb.notEqual(root.get("publicationStatus"), ArticlePublicationStatus.AUTHOR_DELETED));
            if (f.getWorkflowStatus() != null)
                predicates.add(cb.equal(root.get("workflowStatus"), f.getWorkflowStatus()));
            if (f.getPublicationStatus() != null)
                predicates.add(cb.equal(root.get("publicationStatus"), f.getPublicationStatus()));
            if (f.getTopicId() != null) predicates.add(cb.equal(root.get("topic").get("id"), f.getTopicId()));
            if (f.getKeyword() != null && !f.getKeyword().isBlank()) {
                String literal =
                        f.getKeyword().strip().toLowerCase(Locale.ROOT)
                                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                predicates.add(cb.like(cb.lower(root.get("title")), "%" + literal + "%", '\\'));
            }
            if (f.getTagId() != null) {
                var sub = query.subquery(UUID.class);
                var link = sub.from(CourseTag.class);
                sub.select(link.get("id"))
                        .where(cb.equal(link.get("course"), root), cb.equal(link.get("tag").get("id"), f.getTagId()));
                predicates.add(cb.exists(sub));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
