package com.techverse.server.repository.specification;

import static com.techverse.server.repository.specification.PublishedArticleSpecification.literalPattern;
import static com.techverse.server.repository.specification.PublishedArticleSpecification.visible;

import com.techverse.server.dto.request.ArticleFilter;
import com.techverse.server.dto.request.ModeratorArticleFilter;
import com.techverse.server.dto.request.PublishedCourseFilter;
import com.techverse.server.entity.*;
import com.techverse.server.enums.ArticlePublicationStatus;
import com.techverse.server.enums.ArticleWorkflowStatus;

import jakarta.persistence.criteria.*;

import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Author workspace, moderator queue and reader filters; same rules as the article specifications. */
public final class CourseSpecification {
    private CourseSpecification() {}

    public static Specification<Course> filter(UUID owner, ArticleFilter f) {
        return (root, query, cb) -> {
            var predicates = workflow(f, root, query, cb);
            predicates.add(cb.equal(root.get("author").get("id"), owner));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /** Never-submitted drafts are private to their author; author-deleted courses leave the queue. */
    public static Specification<Course> moderator(ModeratorArticleFilter f) {
        return (root, query, cb) -> {
            var predicates = workflow(f, root, query, cb);
            predicates.add(cb.not(cb.and(
                    cb.equal(root.get("publicationStatus"), ArticlePublicationStatus.UNPUBLISHED),
                    cb.equal(root.get("workflowStatus"), ArticleWorkflowStatus.DRAFT))));
            if (f.getAuthorId() != null) predicates.add(cb.equal(root.get("author").get("id"), f.getAuthorId()));
            if (f.getCreatedFrom() != null)
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), f.getCreatedFrom()));
            if (f.getCreatedTo() != null) predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), f.getCreatedTo()));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /** Reader visibility only (same predicate as articles). */
    public static Specification<Course> visibleCourse() {
        return (root, query, cb) -> visible(root, query, cb);
    }

    /** Visible courses filtered on their current snapshot, never on the working copy. */
    public static Specification<Course> published(PublishedCourseFilter f) {
        return (root, query, cb) -> {
            Join<Course, CoursePublicationVersion> v = root.join("publishedVersion");
            var predicates = new ArrayList<Predicate>(List.of(visible(root, query, cb)));
            if (f.getTopicId() != null) predicates.add(cb.equal(v.get("topic").get("id"), f.getTopicId()));
            if (f.getLevel() != null) predicates.add(cb.equal(v.get("level"), f.getLevel()));
            if (f.getKeyword() != null && !f.getKeyword().isBlank())
                predicates.add(cb.like(cb.lower(v.get("title")), literalPattern(f.getKeyword()), '\\'));
            if (f.getTagId() != null) {
                var sub = query.subquery(UUID.class);
                var link = sub.from(CourseVersionTag.class);
                sub.select(link.get("id"))
                        .where(cb.equal(link.get("version"), v), cb.equal(link.get("tag").get("id"), f.getTagId()));
                predicates.add(cb.exists(sub));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    /**
     * Active FREE enrollments of a learner whose course is visible now, most recently accessed first
     * (never-opened last), then newest grant. Callers pass an unsorted Pageable so this order stays.
     */
    public static Specification<CourseEnrollment> myCourses(UUID user) {
        return (root, query, cb) -> {
            if (!Long.class.equals(query.getResultType()))
                query.orderBy(
                        cb.desc(root.get("lastAccessedAt"), Nulls.LAST),
                        cb.desc(root.get("grantedAt")),
                        cb.desc(root.get("id")));
            return cb.and(
                    cb.equal(root.get("userId"), user),
                    cb.isNull(root.get("revokedAt")),
                    cb.equal(root.get("source"), "FREE"),
                    visible(root.join("course"), query, cb));
        };
    }

    private static List<Predicate> workflow(ArticleFilter f, Root<Course> root, CriteriaQuery<?> query, CriteriaBuilder cb) {
        var predicates = new ArrayList<Predicate>();
        predicates.add(cb.notEqual(root.get("publicationStatus"), ArticlePublicationStatus.AUTHOR_DELETED));
        if (f.getWorkflowStatus() != null) predicates.add(cb.equal(root.get("workflowStatus"), f.getWorkflowStatus()));
        if (f.getPublicationStatus() != null)
            predicates.add(cb.equal(root.get("publicationStatus"), f.getPublicationStatus()));
        if (f.getTopicId() != null) predicates.add(cb.equal(root.get("topic").get("id"), f.getTopicId()));
        if (f.getKeyword() != null && !f.getKeyword().isBlank())
            predicates.add(cb.like(cb.lower(root.get("title")), literalPattern(f.getKeyword()), '\\'));
        if (f.getTagId() != null) {
            var sub = query.subquery(UUID.class);
            var link = sub.from(CourseTag.class);
            sub.select(link.get("id"))
                    .where(cb.equal(link.get("course"), root), cb.equal(link.get("tag").get("id"), f.getTagId()));
            predicates.add(cb.exists(sub));
        }
        return predicates;
    }
}
