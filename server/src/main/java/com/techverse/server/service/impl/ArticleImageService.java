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

    public ArticleImageResponse upload(UUID actor, UUID id, UUID key, MultipartFile file) {
        var tx = new TransactionTemplate(transactionManager);
        tx.setTimeout(40);
        tx.executeWithoutResult(
                s -> {
                    access.lockWriter(actor);
                    access.lockEditable(actor, id);
                });
        limits.check(actor, true);
        if (!uploads.tryAcquire()) throw new CustomException(ErrorCode.ARTICLE_RATE_LIMITED);
        try {
            DecodedArticleImage image = decoder.decode(file);
            String publicId = prefix(actor, id) + key;
            var asset =
                    storage.find(publicId)
                            .orElseGet(() -> storage.upload(publicId, actor, id, image));
            if (!Objects.equals(image.fingerprint(), asset.fingerprint()))
                throw new CustomException(ErrorCode.ARTICLE_KEY_CONFLICT);
            validateAsset(asset, actor, id);
            if (!asset.publicId().equals(publicId))
                throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
            // Provider call is outside DB transaction; eligibility may have changed while
            // uploading.
            var live =
                    tx.execute(
                            s -> {
                                access.lockWriter(actor);
                                access.lockEditable(actor, id);
                                var current =
                                        storage.find(publicId)
                                                .orElseThrow(
                                                        () ->
                                                                new CustomException(
                                                                        ErrorCode
                                                                                .ARTICLE_IMAGE_INVALID));
                                validateAsset(current, actor, id);
                                if (!Objects.equals(asset.assetId(), current.assetId()))
                                    throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
                                // Cleanup uses this same Article lock. Renew grace durably before
                                // returning.
                                var renewed = storage.renew(current, java.time.Instant.now());
                                validateAsset(renewed, actor, id);
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

    /** Caller holds the Article lock, also used by final cleanup reference-check/delete. */
    public void validateReferences(Article article) {
        var urls = references(article);
        if (urls.size() > 50) throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
        for (String url : urls) {
            String publicId = publicId(url);
            if (!publicId.startsWith(prefix(article.getAuthor().getId(), article.getId())))
                throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
            var asset =
                    storage.find(publicId)
                            .orElseThrow(
                                    () -> new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID));
            validateAsset(asset, article.getAuthor().getId(), article.getId());
            if (!url.equals(asset.url()))
                throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
        }
    }

    public Set<String> references(Article article) {
        var urls = new HashSet<>(content.imageUrls(article.getContent()));
        if (article.getCoverImageUrl() != null) urls.add(article.getCoverImageUrl());
        return urls;
    }

    public String prefix(UUID owner, UUID article) {
        return properties.folder() + "/" + owner + "/" + article + "/";
    }

    public boolean isManaged(ArticleImageAsset asset) {
        return asset.ownerId() != null
                && asset.assetId() != null
                && !asset.assetId().isBlank()
                && asset.articleId() != null
                && asset.createdAt() != null
                && asset.publicId() != null
                && asset.publicId().startsWith(prefix(asset.ownerId(), asset.articleId()));
    }

    private void validateAsset(ArticleImageAsset asset, UUID owner, UUID article) {
        if (!isManaged(asset)
                || asset.retiring()
                || !owner.equals(asset.ownerId())
                || !article.equals(asset.articleId())
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
