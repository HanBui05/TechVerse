package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.ArticleImageAsset;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.repository.ArticlePublicationVersionRepository;
import com.techverse.server.repository.ArticleRepository;
import com.techverse.server.repository.CoursePublicationVersionRepository;
import com.techverse.server.repository.CourseRepository;
import com.techverse.server.repository.CourseVersionLessonRepository;
import com.techverse.server.repository.LessonRepository;
import com.techverse.server.service.ArticleImageStorage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class ArticleImageCleanupService {
    private final ArticleImageStorage storage;
    private final ArticleImageService images;
    private final ArticleRepository articles;
    private final ArticlePublicationVersionRepository versions;
    private final ArticleContentService content;
    private final CloudinaryProperties properties;
    private final PlatformTransactionManager transactionManager;
    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final CoursePublicationVersionRepository courseVersions;
    private final CourseVersionLessonRepository versionLessons;
    private String cursor;

    @Scheduled(
            fixedDelayString = "${article.image-cleanup-delay:3600000}",
            initialDelayString = "${article.image-cleanup-initial-delay:600000}")
    public void scheduledClean() {
        if (!properties.cleanupEnabled()) return;
        try {
            clean();
        } catch (Exception e) {
            log.warn("Article image cleanup postponed; storage operation failed");
        }
    }

    public synchronized void clean() {
        if (!storage.configured()) return;
        Instant cutoff = Instant.now().minusSeconds(24 * 3600);
        for (int page = 0; page < 2; page++) {
            var batch = storage.list(cursor);
            for (var asset : batch.assets()) {
                if (!images.isManaged(asset) || !lastTouched(asset).isBefore(cutoff)) continue;
                try {
                    removeIfUnused(asset, cutoff);
                } catch (Exception e) {
                    log.warn("Article image cleanup candidate retained for retry");
                }
            }
            cursor = batch.nextCursor();
            if (cursor == null) break;
        }
    }

    private void removeIfUnused(ArticleImageAsset asset, Instant cutoff) {
        var tx = new TransactionTemplate(transactionManager);
        tx.setTimeout(45);
        tx.executeWithoutResult(
                s -> {
                    // Same row lock as uploads/saves of the owning document (course row for lessons).
                    boolean inUse =
                            switch (asset.effectiveScope()) {
                                case ARTICLE -> articleInUse(asset, cutoff);
                                case COURSE -> courseInUse(asset, cutoff);
                                case LESSON -> lessonInUse(asset, cutoff);
                            };
                    // Inventory may predate a retry. Read current durable metadata under the lock.
                    var current = storage.find(asset.publicId()).orElse(null);
                    if (inUse
                            || current == null
                            || !images.isManaged(current)
                            || !current.assetId().equals(asset.assetId())
                            || !lastTouched(current).isBefore(cutoff)) return;
                    // A timed-out DELETE may finish after this transaction releases its lock.
                    // Persist a one-way retirement marker first; no save/retry may reuse it.
                    var retired = current.retiring() ? current : storage.retire(current);
                    if (!retired.retiring() || !current.assetId().equals(retired.assetId()))
                        throw new IllegalStateException("Asset retirement not confirmed");
                    // Immutable ID prevents a late delete from targeting a newly uploaded
                    // incarnation.
                    storage.delete(retired.assetId());
                });
    }

    /** Any edit delays deletion: a detached image receives a fresh grace period. */
    private boolean articleInUse(ArticleImageAsset asset, Instant cutoff) {
        var found = articles.findByIdForUpdate(asset.articleId());
        if (found.isEmpty()) return false;
        var article = found.get();
        return !article.getAuthor().getId().equals(asset.ownerId())
                || !article.getUpdatedAt().isBefore(cutoff)
                || images.references(article).contains(asset.url())
                || referencedByAnyVersion(article.getId(), asset.url());
    }

    private boolean courseInUse(ArticleImageAsset asset, Instant cutoff) {
        var found = courses.findByIdForUpdate(asset.articleId());
        if (found.isEmpty()) return false;
        var course = found.get();
        if (!course.getAuthor().getId().equals(asset.ownerId())
                || !course.getUpdatedAt().isBefore(cutoff)
                || asset.url().equals(course.getCoverImageUrl())
                || content.imageUrls(course.getDescription()).contains(asset.url())) return true;
        for (Object[] source : courseVersions.findImageSources(course.getId()))
            if (asset.url().equals(source[1]) || content.imageUrls((String) source[0]).contains(asset.url()))
                return true;
        return false;
    }

    private boolean lessonInUse(ArticleImageAsset asset, Instant cutoff) {
        var course = courses.findByIdForUpdate(asset.parentId());
        if (course.isEmpty()) return false;
        if (!course.get().getAuthor().getId().equals(asset.ownerId())) return true;
        // Snapshots first, independent of the working row: never lose a published image.
        for (String text : versionLessons.findContentsByLessonId(asset.articleId()))
            if (mentions(text, asset.url())) return true;
        var found = lessons.findById(asset.articleId());
        if (found.isEmpty()) return false;
        var lesson = found.get();
        return !lesson.getUpdatedAt().isBefore(cutoff) || mentions(lesson.getContent(), asset.url());
    }

    private boolean mentions(String text, String url) {
        return text != null && content.imageUrls(text).contains(url);
    }

    /** Snapshots are immutable and may be restored by discard: their images must survive. */
    private boolean referencedByAnyVersion(java.util.UUID articleId, String url) {
        for (Object[] source : versions.findImageSources(articleId))
            if (url.equals(source[1]) || content.imageUrls((String) source[0]).contains(url))
                return true;
        return false;
    }

    private Instant lastTouched(ArticleImageAsset asset) {
        return asset.touchedAt() == null || asset.touchedAt().isBefore(asset.createdAt())
                ? asset.createdAt()
                : asset.touchedAt();
    }
}
