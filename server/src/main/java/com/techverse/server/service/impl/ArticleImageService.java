package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.*;
import com.techverse.server.dto.response.ArticleImageResponse;
import com.techverse.server.entity.Article;
import com.techverse.server.exception.*;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.service.ArticleImageStorage;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.*;
import java.util.concurrent.Semaphore;

@Service
@RequiredArgsConstructor
public class ArticleImageService {
    private final ArticleAccessService access;
    private final ArticleImageStorage storage;
    private final ArticleImageDecoder decoder;
    private final ArticleContentService content;
    private final ArticleRateLimitService limits;
    private final CloudinaryProperties properties;
    private final PlatformTransactionManager transactionManager;
    private final Semaphore uploads = new Semaphore(4);

    /** Owning document of an image; {@code parent} is the course of a LESSON. */
    public record Target(ArticleImageAsset.Scope scope, UUID owner, UUID document, UUID parent) {
        public static Target article(UUID owner, UUID article) {
            return new Target(ArticleImageAsset.Scope.ARTICLE, owner, article, null);
        }

        public static Target course(UUID owner, UUID course) {
            return new Target(ArticleImageAsset.Scope.COURSE, owner, course, null);
        }

        public static Target lesson(UUID owner, UUID lesson, UUID course) {
            return new Target(ArticleImageAsset.Scope.LESSON, owner, lesson, course);
        }

        static Target of(ArticleImageAsset asset) {
            return new Target(asset.effectiveScope(), asset.ownerId(), asset.articleId(), asset.parentId());
        }
    }

    public ArticleImageResponse upload(UUID actor, UUID id, UUID key, MultipartFile file) {
        return upload(
                Target.article(actor, id),
                key,
                file,
                () -> {
                    access.lockWriter(actor);
                    access.lockEditable(actor, id);
                });
    }

    /**
     * Upload outside any DB transaction; {@code lockCheck} runs (in its own transaction) before and
     * after the provider call and must take the same row lock cleanup uses for this document.
     */
    public ArticleImageResponse upload(Target target, UUID key, MultipartFile file, Runnable lockCheck) {
        UUID actor = target.owner(), id = target.document();
        var tx = new TransactionTemplate(transactionManager);
        tx.setTimeout(40);
        tx.executeWithoutResult(s -> lockCheck.run());
        limits.check(actor, true);
        if (!uploads.tryAcquire()) throw new CustomException(ErrorCode.ARTICLE_RATE_LIMITED);
        try {
            DecodedArticleImage image = decoder.decode(file);
            String publicId = prefix(target) + key;
            var asset =
                    storage.find(publicId)
                            .orElseGet(
                                    () ->
                                            target.scope() == ArticleImageAsset.Scope.ARTICLE
                                                    ? storage.upload(publicId, actor, id, image)
                                                    : storage.upload(
                                                            publicId,
                                                            target.scope(),
                                                            actor,
                                                            id,
                                                            target.parent(),
                                                            image));
            if (!Objects.equals(image.fingerprint(), asset.fingerprint()))
                throw new CustomException(ErrorCode.ARTICLE_KEY_CONFLICT);
            validateAsset(asset, target);
            if (!asset.publicId().equals(publicId))
                throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
            // Provider call is outside DB transaction; eligibility may have changed while
            // uploading.
            var live =
                    tx.execute(
                            s -> {
                                lockCheck.run();
                                var current =
                                        storage.find(publicId)
                                                .orElseThrow(
                                                        () ->
                                                                new CustomException(
                                                                        ErrorCode
                                                                                .ARTICLE_IMAGE_INVALID));
                                validateAsset(current, target);
                                if (!Objects.equals(asset.assetId(), current.assetId()))
                                    throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
                                // Cleanup uses this same Article lock. Renew grace durably before
                                // returning.
                                var renewed = storage.renew(current, java.time.Instant.now());
                                validateAsset(renewed, target);
                                if (!current.assetId().equals(renewed.assetId()))
                                    throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
                                return renewed;
                            });
            return ArticleImageResponse.builder()
                    .url(live.url())
                    .publicId(live.publicId())
                    .width(live.width())
                    .height(live.height())
                    .uploadKey(key)
                    .build();
        } finally {
            uploads.release();
        }
    }

    /**
     * SUBMIT/APPROVE: every image must be a live managed asset of this article. Caller holds the
     * Article lock, also used by final cleanup reference-check/delete.
     */
    public void validateReferences(Article article) {
        checkImageCount(article);
        for (String url : references(article)) validateManaged(url, article);
    }

    /** SAVE: Markdown may keep pending images (reported as issues); the cover never may. */
    public void validateDraft(Article article) {
        checkImageCount(article);
        if (article.getCoverImageUrl() != null)
            validateManaged(article.getCoverImageUrl(), article);
    }

    /** The 50-image cap counts every Markdown image node (repeats included) plus the cover. */
    private void checkImageCount(Article article) {
        int count = content.imageUrls(article.getContent()).size();
        if (article.getCoverImageUrl() != null) count++;
        if (count > 50) invalid();
    }

    /** Syntactic check only (no provider call): is this URL this article's managed asset? */
    public boolean isOwnManagedUrl(String url, Article article) {
        return isOwnManagedUrl(url, articleTarget(article));
    }

    public boolean isOwnManagedUrl(String url, Target target) {
        try {
            return publicId(url).startsWith(prefix(target));
        } catch (CustomException e) {
            return false;
        }
    }

    private void validateManaged(String url, Article article) {
        validateManaged(url, articleTarget(article));
    }

    /** Provider check: {@code url} is a live managed asset of exactly this document. */
    public void validateManaged(String url, Target target) {
        String publicId = publicId(url);
        if (!publicId.startsWith(prefix(target))) invalid();
        var asset = storage.find(publicId).orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID));
        validateAsset(asset, target);
        if (!url.equals(asset.url())) invalid();
    }

    private static Target articleTarget(Article article) {
        return Target.article(article.getAuthor().getId(), article.getId());
    }

    public Set<String> references(Article article) {
        var urls = new HashSet<>(content.imageUrls(article.getContent()));
        if (article.getCoverImageUrl() != null) urls.add(article.getCoverImageUrl());
        return urls;
    }

    public String prefix(UUID owner, UUID article) {
        return properties.folder() + "/" + owner + "/" + article + "/";
    }

    /** Scopes never share a prefix: an image of one document is invalid in any other. */
    public String prefix(ArticleImageAsset.Scope scope, UUID owner, UUID document, UUID parent) {
        return switch (scope) {
            case ARTICLE -> prefix(owner, document);
            case COURSE -> properties.folder() + "/course/" + owner + "/" + document + "/";
            case LESSON -> properties.folder() + "/lesson/" + owner + "/" + parent + "/" + document + "/";
        };
    }

    private String prefix(Target t) {
        return prefix(t.scope(), t.owner(), t.document(), t.parent());
    }

    public boolean isManaged(ArticleImageAsset asset) {
        return asset.ownerId() != null
                && asset.assetId() != null
                && !asset.assetId().isBlank()
                && asset.articleId() != null
                && asset.createdAt() != null
                && asset.publicId() != null
                && (asset.effectiveScope() == ArticleImageAsset.Scope.LESSON) == (asset.parentId() != null)
                && asset.publicId().startsWith(prefix(Target.of(asset)));
    }

    private void validateAsset(ArticleImageAsset asset, Target target) {
        if (!isManaged(asset)
                || asset.retiring()
                || !target.equals(Target.of(asset))
                || asset.width() < 1
                || asset.height() < 1
                || !asset.publicId().equals(publicId(asset.url())))
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
    }

    private String publicId(String url) {
        try {
            URI uri = URI.create(url);
            if (!"https".equals(uri.getScheme())
                    || !"res.cloudinary.com".equals(uri.getHost())
                    || uri.getPort() != -1
                    || uri.getRawQuery() != null
                    || uri.getRawFragment() != null
                    || uri.getUserInfo() != null) invalid();
            String start = "/" + properties.cloudName() + "/image/upload/";
            String path = uri.getRawPath();
            if (!path.startsWith(start)) invalid();
            String scoped = path.substring(start.length());
            int slash = scoped.indexOf('/');
            if (slash < 0 || !scoped.substring(0, slash).matches("v[0-9]+")) invalid();
            String id = scoped.substring(slash + 1);
            if (!id.endsWith(".png")) invalid();
            id = id.substring(0, id.length() - 4);
            if (!id.matches("[A-Za-z0-9_/-]+")) invalid();
            return id;
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
        }
    }

    private void invalid() {
        throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
    }
}
