package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.ArticleImageAsset;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.repository.ArticleRepository;
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
    private final CloudinaryProperties properties;
    private final PlatformTransactionManager transactionManager;
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
                    var found = articles.findByIdForUpdate(asset.articleId());
                    // Inventory may predate a retry. Read current durable metadata under the lock.
                    var current = storage.find(asset.publicId()).orElse(null);
                    if (current == null
                            || !images.isManaged(current)
                            || !current.assetId().equals(asset.assetId())
                            || !lastTouched(current).isBefore(cutoff)) return;
                    if (found.isPresent()) {
                        var article = found.get();
                        if (!article.getAuthor().getId().equals(asset.ownerId())) return;
                        // Any edit delays deletion: a detached image receives a fresh grace period.
                        if (!article.getUpdatedAt().isBefore(cutoff)
                                || images.references(article).contains(asset.url())) return;
                    }
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

    private Instant lastTouched(ArticleImageAsset asset) {
        return asset.touchedAt() == null || asset.touchedAt().isBefore(asset.createdAt())
                ? asset.createdAt()
                : asset.touchedAt();
    }
}
