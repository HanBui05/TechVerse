package com.techverse.server.repository;

import com.techverse.server.dto.internal.PublishedArticleRow;
import com.techverse.server.dto.response.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.ArticleStatus;
import com.techverse.server.repository.specification.PublishedArticleSpecification;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.*;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

/** Reader-only scalar queries; no collection fetch joins, entity hydration or write locks. */
@Repository
@RequiredArgsConstructor
public class PublishedArticleRepository {
    private static final int RELATED_LIMIT = 6;
    private final EntityManager entityManager;

    /** Count and page scalar metadata without retrieving article Markdown or multiplying tags. */
    public Page<PublishedArticleRow> findPage(Specification<Article> spec, Pageable pageable) {
        var cb = entityManager.getCriteriaBuilder();
        var countQuery = cb.createQuery(Long.class);
        var countRoot = countQuery.from(Article.class);
        countQuery.select(cb.count(countRoot)).where(spec.toPredicate(countRoot, countQuery, cb));
        long total = entityManager.createQuery(countQuery).getSingleResult();
        if (pageable.getOffset() >= total || pageable.getOffset() > Integer.MAX_VALUE)
            return new PageImpl<>(List.of(), pageable, total);

        var query = cb.createTupleQuery();
        var root = query.from(Article.class);
        selectArticle(query, root, false);
        query.where(spec.toPredicate(root, query, cb));
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
                        .map(this::articleRow)
                        .toList();
        return new PageImpl<>(rows, pageable, total);
    }

    /** Retrieve Markdown only when the requested article is currently published. */
    public Optional<PublishedArticleRow> findPublishedById(UUID id) {
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(Article.class);
        selectArticle(query, root, true);
        query.where(
                cb.equal(root.get("id"), id),
                cb.equal(root.get("status"), ArticleStatus.PUBLISHED));
        return entityManager.createQuery(query).getResultStream().map(this::articleRow).findFirst();
    }

    /** Batch-load safe tag labels for published page/detail IDs in one query. */
    public Map<UUID, List<ArticleTaxonomyResponse>> findTags(Collection<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(ArticleTag.class);
        var tag = root.join("tag");
        query.multiselect(
                root.get("article").get("id").alias("articleId"),
                tag.get("id").alias("id"),
                tag.get("name").alias("name"));
        query.where(
                root.get("article").get("id").in(ids),
                cb.equal(root.get("article").get("status"), ArticleStatus.PUBLISHED));
        query.orderBy(cb.asc(tag.get("name")), cb.asc(tag.get("id")));
        Map<UUID, List<ArticleTaxonomyResponse>> tags = new HashMap<>();
        for (Tuple tuple : entityManager.createQuery(query).getResultList())
            tags.computeIfAbsent(tuple.get("articleId", UUID.class), ignored -> new ArrayList<>())
                    .add(taxonomy(tuple));
        return tags;
    }

    /** Rank same-topic published articles by shared tags, then recency, with a DB-side cap. */
    public List<RelatedArticleResponse> findRelated(UUID sourceId, UUID topicId) {
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(Article.class);
        var sourceTags = query.subquery(UUID.class);
        var sourceLink = sourceTags.from(ArticleTag.class);
        sourceTags
                .select(sourceLink.get("tag").get("id"))
                .where(
                        cb.equal(sourceLink.get("article").get("id"), sourceId),
                        cb.equal(sourceLink.get("article").get("status"), ArticleStatus.PUBLISHED));
        var matchingTags = root.join("articleTags", JoinType.LEFT);
        matchingTags.on(matchingTags.get("tag").get("id").in(sourceTags));
        var sharedCount = cb.count(matchingTags.get("id"));
        query.multiselect(
                root.get("id").alias("id"),
                root.get("title").alias("title"),
                root.get("coverImageUrl").alias("coverImageUrl"),
                root.get("publishedAt").alias("publishedAt"),
                sharedCount.alias("sharedCount"));
        query.where(
                cb.equal(root.get("status"), ArticleStatus.PUBLISHED),
                cb.equal(root.get("topic").get("id"), topicId),
                cb.notEqual(root.get("id"), sourceId));
        query.groupBy(
                root.get("id"),
                root.get("title"),
                root.get("coverImageUrl"),
                root.get("publishedAt"));
        query.orderBy(
                cb.desc(sharedCount), cb.desc(root.get("publishedAt")), cb.asc(root.get("id")));
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

    /** Page topic labels that occur on published articles, including inactive historic topics. */
    public Page<ArticleTaxonomyResponse> findTopics(String keyword, Pageable pageable) {
        return findTaxonomy(Topic.class, keyword, pageable);
    }

    /** Page tag labels that occur on published articles, including inactive historic tags. */
    public Page<ArticleTaxonomyResponse> findTags(String keyword, Pageable pageable) {
        return findTaxonomy(Tag.class, keyword, pageable);
    }

    /** Share bounded scalar paging between independent topic/tag option searches. */
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

    /** Require published usage via EXISTS so options are never duplicated by article count. */
    private Predicate taxonomyPredicate(
            Class<?> type, Root<?> root, CriteriaQuery<?> query, String keyword) {
        var cb = entityManager.getCriteriaBuilder();
        var usage = query.subquery(UUID.class);
        if (type == Topic.class) {
            var article = usage.from(Article.class);
            usage.select(article.get("id"))
                    .where(
                            cb.equal(article.get("topic").get("id"), root.get("id")),
                            cb.equal(article.get("status"), ArticleStatus.PUBLISHED));
        } else {
            var link = usage.from(ArticleTag.class);
            usage.select(link.get("id"))
                    .where(
                            cb.equal(link.get("tag").get("id"), root.get("id")),
                            cb.equal(link.get("article").get("status"), ArticleStatus.PUBLISHED));
        }
        var publishedUsage = cb.exists(usage);
        if (keyword == null || keyword.isBlank()) return publishedUsage;
        return cb.and(
                publishedUsage,
                cb.like(
                        cb.lower(root.get("name").as(String.class)),
                        PublishedArticleSpecification.literalPattern(keyword),
                        '\\'));
    }

    /** Select only public metadata; list queries deliberately use a null literal for content. */
    private void selectArticle(
            CriteriaQuery<Tuple> query, Root<Article> root, boolean includeContent) {
        var author = root.join("author");
        var topic = root.join("topic");
        query.multiselect(
                root.get("id").alias("id"),
                root.get("title").alias("title"),
                root.get("summary").alias("summary"),
                root.get("coverImageUrl").alias("coverImageUrl"),
                root.get("publishedAt").alias("publishedAt"),
                root.get("updatedAt").alias("updatedAt"),
                author.get("id").alias("authorId"),
                author.get("fullName").alias("authorName"),
                author.get("avatarUrl").alias("authorAvatar"),
                topic.get("id").alias("topicId"),
                topic.get("name").alias("topicName"),
                (includeContent
                                ? root.<String>get("content")
                                : entityManager.getCriteriaBuilder().nullLiteral(String.class))
                        .alias("content"));
    }

    /** Map scalar tuples into the internal public-article read model without lazy loads. */
    private PublishedArticleRow articleRow(Tuple row) {
        return PublishedArticleRow.builder()
                .id(row.get("id", UUID.class))
                .title(row.get("title", String.class))
                .summary(row.get("summary", String.class))
                .content(row.get("content", String.class))
                .coverImageUrl(row.get("coverImageUrl", String.class))
                .publishedAt(row.get("publishedAt", Instant.class))
                .updatedAt(row.get("updatedAt", Instant.class))
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

    /** Map an option/tag tuple into the minimal id/name response. */
    private ArticleTaxonomyResponse taxonomy(Tuple tuple) {
        return ArticleTaxonomyResponse.builder()
                .id(tuple.get("id", UUID.class))
                .name(tuple.get("name", String.class))
                .build();
    }
}
