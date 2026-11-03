package com.techverse.server.repository;

import static com.techverse.server.repository.specification.PublishedArticleSpecification.*;

import com.techverse.server.dto.internal.PublishedArticleRow;
import com.techverse.server.dto.request.PublishedArticleFilter;
import com.techverse.server.dto.response.*;
import com.techverse.server.entity.*;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.*;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.*;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

/**
 * Reader-only scalar queries over the current approved snapshot. Working-copy columns of {@code
 * articles} are never selected; no entity hydration, fetch joins or write locks.
 */
@Repository
@RequiredArgsConstructor
public class PublishedArticleRepository {
    private static final int RELATED_LIMIT = 5;
    private final EntityManager entityManager;

    /** Count and page snapshot metadata without retrieving Markdown or multiplying tags. */
    public Page<PublishedArticleRow> findPage(PublishedArticleFilter filter, Pageable pageable) {
        var cb = entityManager.getCriteriaBuilder();
        var countQuery = cb.createQuery(Long.class);
        var countRoot = countQuery.from(Article.class);
        Join<Article, ArticlePublicationVersion> countVersion = countRoot.join("publishedVersion");
        countQuery
                .select(cb.count(countRoot))
                .where(filter(filter, countRoot, countVersion, countQuery, cb));
        long total = entityManager.createQuery(countQuery).getSingleResult();
        if (pageable.getOffset() >= total || pageable.getOffset() > Integer.MAX_VALUE)
            return new PageImpl<>(List.of(), pageable, total);

        var query = cb.createTupleQuery();
        var root = query.from(Article.class);
        Join<Article, ArticlePublicationVersion> version = root.join("publishedVersion");
        select(query, root, version, false);
        query.where(filter(filter, root, version, query, cb));
        query.orderBy(
                pageable.getSort().stream()
                        .map(
                                order ->
                                        order.isAscending()
                                                ? cb.asc(root.get(order.getProperty()))
                                                : cb.desc(root.get(order.getProperty())))
                        .toList());
        var rows =
                entityManager
                        .createQuery(query)
                        .setFirstResult((int) pageable.getOffset())
                        .setMaxResults(pageable.getPageSize())
                        .getResultList()
                        .stream()
                        .map(this::row)
                        .toList();
        return new PageImpl<>(rows, pageable, total);
    }

    /** Snapshot Markdown only when the article is currently visible. */
    public Optional<PublishedArticleRow> findVisibleById(UUID id) {
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(Article.class);
        Join<Article, ArticlePublicationVersion> version = root.join("publishedVersion");
        select(query, root, version, true);
        query.where(cb.equal(root.get("id"), id), visible(root, query, cb));
        return entityManager.createQuery(query).getResultStream().map(this::row).findFirst();
    }

    /** Batch-load tag labels of the given snapshot versions in one query. */
    public Map<UUID, List<ArticleTaxonomyResponse>> findTags(Collection<UUID> versionIds) {
        if (versionIds.isEmpty()) return Map.of();
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var link = query.from(ArticlePublicationVersionTag.class);
        var tag = link.join("tag");
        query.multiselect(
                link.get("version").get("id").alias("versionId"),
                tag.get("id").alias("id"),
                tag.get("name").alias("name"));
        query.where(link.get("version").get("id").in(versionIds));
        query.orderBy(cb.asc(tag.get("name")), cb.asc(tag.get("id")));
        Map<UUID, List<ArticleTaxonomyResponse>> tags = new HashMap<>();
        for (Tuple tuple : entityManager.createQuery(query).getResultList())
            tags.computeIfAbsent(tuple.get("versionId", UUID.class), ignored -> new ArrayList<>())
                    .add(taxonomy(tuple));
        return tags;
    }

    /** Public card fields of the author profile: expertise and raw bio (excerpted by caller). */
    public Optional<Object[]> findAuthorProfile(UUID authorId) {
        return entityManager
                .createQuery(
                        "select p.expertise, p.bio from AuthorProfile p where p.user.id = :id",
                        Object[].class)
                .setParameter("id", authorId)
                .getResultStream()
                .findFirst();
    }

    /** Visible snapshots with the same topic or any shared tag, newest first, capped in SQL. */
    public List<RelatedArticleResponse> findRelated(
            UUID sourceId, UUID topicId, Collection<UUID> tagIds) {
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(Article.class);
        Join<Article, ArticlePublicationVersion> version = root.join("publishedVersion");
        Predicate match = cb.equal(version.get("topic").get("id"), topicId);
        if (!tagIds.isEmpty()) {
            var shared = query.subquery(UUID.class);
            var link = shared.from(ArticlePublicationVersionTag.class);
            shared.select(link.get("id"))
                    .where(
                            cb.equal(link.get("version"), version),
                            link.get("tag").get("id").in(tagIds));
            match = cb.or(match, cb.exists(shared));
        }
        query.multiselect(
                root.get("id").alias("id"),
                version.get("title").alias("title"),
                version.get("coverImageUrl").alias("coverImageUrl"),
                root.get("publishedAt").alias("publishedAt"));
        query.where(visible(root, query, cb), cb.notEqual(root.get("id"), sourceId), match);
        query.orderBy(cb.desc(root.get("publishedAt")), cb.asc(root.get("id")));
        return entityManager
                .createQuery(query)
                .setMaxResults(RELATED_LIMIT)
                .getResultList()
                .stream()
                .map(
                        tuple ->
                                RelatedArticleResponse.builder()
                                        .id(tuple.get("id", UUID.class))
                                        .title(tuple.get("title", String.class))
                                        .coverImageUrl(tuple.get("coverImageUrl", String.class))
                                        .publishedAt(tuple.get("publishedAt", Instant.class))
                                        .build())
                .toList();
    }

    /** Topics used by visible snapshots, including inactive historic topics. */
    public Page<ArticleTaxonomyResponse> findTopics(String keyword, Pageable pageable) {
        return findTaxonomy(Topic.class, keyword, pageable);
    }

    /** Tags used by visible snapshots, including inactive historic tags. */
    public Page<ArticleTaxonomyResponse> findTags(String keyword, Pageable pageable) {
        return findTaxonomy(Tag.class, keyword, pageable);
    }

    private <T> Page<ArticleTaxonomyResponse> findTaxonomy(
            Class<T> type, String keyword, Pageable pageable) {
        var cb = entityManager.getCriteriaBuilder();
        var countQuery = cb.createQuery(Long.class);
        var countRoot = countQuery.from(type);
        countQuery
                .select(cb.count(countRoot))
                .where(taxonomyPredicate(type, countRoot, countQuery, keyword));
        long total = entityManager.createQuery(countQuery).getSingleResult();
        if (pageable.getOffset() >= total || pageable.getOffset() > Integer.MAX_VALUE)
            return new PageImpl<>(List.of(), pageable, total);
        var query = cb.createTupleQuery();
        var root = query.from(type);
        query.multiselect(root.get("id").alias("id"), root.get("name").alias("name"));
        query.where(taxonomyPredicate(type, root, query, keyword));
        query.orderBy(cb.asc(root.get("name")), cb.asc(root.get("id")));
        var rows =
                entityManager
                        .createQuery(query)
                        .setFirstResult((int) pageable.getOffset())
                        .setMaxResults(pageable.getPageSize())
                        .getResultList()
                        .stream()
                        .map(this::taxonomy)
                        .toList();
        return new PageImpl<>(rows, pageable, total);
    }

    /** Require visible-snapshot usage via EXISTS so options are never duplicated. */
    private Predicate taxonomyPredicate(
            Class<?> type, Root<?> root, CriteriaQuery<?> query, String keyword) {
        var cb = entityManager.getCriteriaBuilder();
        var usage = query.subquery(UUID.class);
        var article = usage.from(Article.class);
        Join<Article, ArticlePublicationVersion> version = article.join("publishedVersion");
        if (type == Topic.class) {
            usage.select(article.get("id"))
                    .where(
                            cb.equal(version.get("topic").get("id"), root.get("id")),
                            visible(article, usage, cb));
        } else {
            var link = usage.from(ArticlePublicationVersionTag.class);
            usage.select(article.get("id"))
                    .where(
                            cb.equal(link.get("version"), version),
                            cb.equal(link.get("tag").get("id"), root.get("id")),
                            visible(article, usage, cb));
        }
        var used = cb.exists(usage);
        if (keyword == null || keyword.isBlank()) return used;
        return cb.and(
                used,
                cb.like(cb.lower(root.get("name").as(String.class)), literalPattern(keyword), '\\'));
    }

    /** Snapshot fields + stable article id/first publication; list uses a null content literal. */
    private void select(
            CriteriaQuery<Tuple> query,
            Root<Article> root,
            Join<Article, ArticlePublicationVersion> version,
            boolean includeContent) {
        var author = root.join("author");
        var topic = version.join("topic");
        query.multiselect(
                root.get("id").alias("id"),
                version.get("id").alias("versionId"),
                version.get("title").alias("title"),
                version.get("summary").alias("summary"),
                version.get("coverImageUrl").alias("coverImageUrl"),
                root.get("publishedAt").alias("publishedAt"),
                version.get("approvedAt").alias("approvedAt"),
                version.get("versionNumber").alias("versionNumber"),
                version.get("readingMinutes").alias("readingMinutes"),
                author.get("id").alias("authorId"),
                author.get("fullName").alias("authorName"),
                author.get("avatarUrl").alias("authorAvatar"),
                topic.get("id").alias("topicId"),
                topic.get("name").alias("topicName"),
                (includeContent
                                ? version.<String>get("content")
                                : entityManager.getCriteriaBuilder().nullLiteral(String.class))
                        .alias("content"));
    }

    private PublishedArticleRow row(Tuple row) {
        return PublishedArticleRow.builder()
                .id(row.get("id", UUID.class))
                .versionId(row.get("versionId", UUID.class))
                .title(row.get("title", String.class))
                .summary(row.get("summary", String.class))
                .content(row.get("content", String.class))
                .coverImageUrl(row.get("coverImageUrl", String.class))
                .publishedAt(row.get("publishedAt", Instant.class))
                .approvedAt(row.get("approvedAt", Instant.class))
                .versionNumber(row.get("versionNumber", Integer.class))
                .readingMinutes(row.get("readingMinutes", Integer.class))
                .author(
                        ArticleAuthorResponse.builder()
                                .id(row.get("authorId", UUID.class))
                                .fullName(row.get("authorName", String.class))
                                .avatarUrl(row.get("authorAvatar", String.class))
                                .build())
                .topic(
                        ArticleTaxonomyResponse.builder()
                                .id(row.get("topicId", UUID.class))
                                .name(row.get("topicName", String.class))
                                .build())
                .build();
    }

    private ArticleTaxonomyResponse taxonomy(Tuple tuple) {
        return ArticleTaxonomyResponse.builder()
                .id(tuple.get("id", UUID.class))
                .name(tuple.get("name", String.class))
                .build();
    }
}
