package com.techverse.server.repository;

import static com.techverse.server.repository.specification.PublishedArticleSpecification.*;

import com.techverse.server.dto.internal.PublishedArticleRow;
import com.techverse.server.dto.internal.SavedArticleRow;
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
    public Page<PublishedArticleRow> findPage(
            UUID actor, PublishedArticleFilter filter, Pageable pageable) {
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
        select(query, root, version, false, actor);
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
    public Optional<PublishedArticleRow> findVisibleById(UUID actor, UUID id) {
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(Article.class);
        Join<Article, ArticlePublicationVersion> version = root.join("publishedVersion");
        select(query, root, version, true, actor);
        query.where(cb.equal(root.get("id"), id), visible(root, query, cb));
        return entityManager.createQuery(query).getResultStream().map(this::row).findFirst();
    }

    /** Same visibility predicate as reading, without loading any snapshot column. */
    public boolean isVisible(UUID id) {
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createQuery(Long.class);
        var root = query.from(Article.class);
        query.select(cb.count(root)).where(cb.equal(root.get("id"), id), visible(root, query, cb));
        return entityManager.createQuery(query).getSingleResult() > 0;
    }

    /**
     * The actor's saved rows whose article is visible now, newest save first; invisible rows stay
     * in the table and reappear once the article is visible again.
     */
    public Page<SavedArticleRow> findSavedPage(UUID actor, String keyword, Pageable pageable) {
        var cb = entityManager.getCriteriaBuilder();
        var countQuery = cb.createQuery(Long.class);
        var countSaved = countQuery.from(SavedArticle.class);
        Join<SavedArticle, Article> countArticle = countSaved.join("article");
        Join<Article, ArticlePublicationVersion> countVersion = countArticle.join("publishedVersion");
        countQuery
                .select(cb.count(countSaved))
                .where(
                        savedFilter(
                                actor, keyword, countSaved, countArticle, countVersion, countQuery, cb));
        long total = entityManager.createQuery(countQuery).getSingleResult();
        if (pageable.getOffset() >= total || pageable.getOffset() > Integer.MAX_VALUE)
            return new PageImpl<>(List.of(), pageable, total);

        var query = cb.createTupleQuery();
        var saved = query.from(SavedArticle.class);
        Join<SavedArticle, Article> article = saved.join("article");
        Join<Article, ArticlePublicationVersion> version = article.join("publishedVersion");
        var selections = new ArrayList<Selection<?>>(columns(article, version, false));
        selections.add(saved(article, actor, query).alias("saved"));
        selections.add(saved.get("createdAt").alias("savedAt"));
        query.multiselect(selections);
        query.where(savedFilter(actor, keyword, saved, article, version, query, cb));
        query.orderBy(cb.desc(saved.get("createdAt")), cb.desc(saved.get("id")));
        var rows =
                entityManager
                        .createQuery(query)
                        .setFirstResult((int) pageable.getOffset())
                        .setMaxResults(pageable.getPageSize())
                        .getResultList()
                        .stream()
                        .map(tuple -> new SavedArticleRow(row(tuple), tuple.get("savedAt", Instant.class)))
                        .toList();
        return new PageImpl<>(rows, pageable, total);
    }

    private Predicate savedFilter(
            UUID actor,
            String keyword,
            Root<SavedArticle> saved,
            Join<SavedArticle, Article> article,
            Join<Article, ArticlePublicationVersion> version,
            CriteriaQuery<?> query,
            CriteriaBuilder cb) {
        var predicates = new ArrayList<Predicate>();
        predicates.add(cb.equal(saved.get("user").get("id"), actor));
        predicates.add(visible(article, query, cb));
        if (keyword != null && !keyword.isBlank())
            predicates.add(
                    cb.like(
                            cb.lower(version.get("title")),
                            literalPattern(keyword),
                            '\\'));
        return cb.and(predicates.toArray(Predicate[]::new));
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
            UUID actor,
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
                root.get("publishedAt").alias("publishedAt"),
                saved(root, actor, query).alias("saved"));
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
                                        .saved(tuple.get("saved", Boolean.class))
                                        .build())
                .toList();
    }

    /** Topics used by visible snapshots, including inactive historic topics. */
    public Page<ArticleTaxonomyResponse> findTopics(String keyword, Pageable pageable) {
        return findTaxonomy(Topic.class, Article.class, keyword, pageable);
    }

    /** Topics of the current snapshot of visible courses. */
    public Page<ArticleTaxonomyResponse> findCourseTopics(String keyword, Pageable pageable) {
        return findTaxonomy(Topic.class, Course.class, keyword, pageable);
    }

    /** Tags of the current snapshot of visible courses. */
    public Page<ArticleTaxonomyResponse> findCourseTags(String keyword, Pageable pageable) {
        return findTaxonomy(Tag.class, Course.class, keyword, pageable);
    }

    /** Tags used by visible snapshots, including inactive historic tags. */
    public Page<ArticleTaxonomyResponse> findTags(String keyword, Pageable pageable) {
        return findTaxonomy(Tag.class, Article.class, keyword, pageable);
    }

    private <T> Page<ArticleTaxonomyResponse> findTaxonomy(
            Class<T> type, Class<?> owner, String keyword, Pageable pageable) {
        var cb = entityManager.getCriteriaBuilder();
        var countQuery = cb.createQuery(Long.class);
        var countRoot = countQuery.from(type);
        countQuery
                .select(cb.count(countRoot))
                .where(taxonomyPredicate(type, owner, countRoot, countQuery, keyword));
        long total = entityManager.createQuery(countQuery).getSingleResult();
        if (pageable.getOffset() >= total || pageable.getOffset() > Integer.MAX_VALUE)
            return new PageImpl<>(List.of(), pageable, total);
        var query = cb.createTupleQuery();
        var root = query.from(type);
        query.multiselect(root.get("id").alias("id"), root.get("name").alias("name"));
        query.where(taxonomyPredicate(type, owner, root, query, keyword));
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

    /** Require visible-snapshot usage (article or course) via EXISTS so options are never duplicated. */
    private Predicate taxonomyPredicate(
            Class<?> type, Class<?> owner, Root<?> root, CriteriaQuery<?> query, String keyword) {
        var cb = entityManager.getCriteriaBuilder();
        var usage = query.subquery(UUID.class);
        @SuppressWarnings("unchecked") // owner is Article or Course; both expose publishedVersion
        var article = usage.from((Class<Object>) owner);
        Join<Object, Object> version = article.join("publishedVersion");
        if (type == Topic.class) {
            usage.select(article.get("id"))
                    .where(
                            cb.equal(version.get("topic").get("id"), root.get("id")),
                            visible(article, usage, cb));
        } else {
            Class<?> linkType = owner == Course.class ? CourseVersionTag.class : ArticlePublicationVersionTag.class;
            @SuppressWarnings("unchecked")
            var link = usage.from((Class<Object>) linkType);
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

    /** Snapshot columns plus the actor's saved flag as a correlated EXISTS (no per-row query). */
    private void select(
            CriteriaQuery<Tuple> query,
            Root<Article> root,
            Join<Article, ArticlePublicationVersion> version,
            boolean includeContent,
            UUID actor) {
        var selections = new ArrayList<Selection<?>>(columns(root, version, includeContent));
        selections.add(saved(root, actor, query).alias("saved"));
        query.multiselect(selections);
    }

    /** {@code true} when the actor has a saved row for the article; selected via CASE EXISTS. */
    private Expression<Boolean> saved(From<?, Article> article, UUID actor, CriteriaQuery<?> query) {
        var cb = entityManager.getCriteriaBuilder();
        var sub = query.subquery(UUID.class);
        var saved = sub.from(SavedArticle.class);
        sub.select(saved.get("id"))
                .where(
                        cb.equal(saved.get("article"), article),
                        cb.equal(saved.get("user").get("id"), actor));
        return cb.<Boolean>selectCase().when(cb.exists(sub), true).otherwise(false);
    }

    /** Snapshot fields + stable article id/first publication; list uses a null content literal. */
    private List<Selection<?>> columns(
            From<?, Article> root,
            Join<Article, ArticlePublicationVersion> version,
            boolean includeContent) {
        var author = root.join("author");
        var topic = version.join("topic");
        return List.of(
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
                .saved(row.get("saved", Boolean.class))
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
