package com.techverse.server.service;

import com.techverse.server.dto.internal.ArticleImageAsset;
import com.techverse.server.dto.internal.DecodedArticleImage;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ArticleImageStorage {
    Optional<ArticleImageAsset> find(String publicId);

    default ArticleImageAsset upload(String publicId, UUID owner, UUID article, DecodedArticleImage image) {
        return upload(publicId, ArticleImageAsset.Scope.ARTICLE, owner, article, null, image);
    }

    /** {@code document} is the article/course/lesson ID; {@code parent} the course of a LESSON. */
    ArticleImageAsset upload(
            String publicId,
            ArticleImageAsset.Scope scope,
            UUID owner,
            UUID document,
            UUID parent,
            DecodedArticleImage image);

    AssetPage list(String cursor);

    ArticleImageAsset renew(ArticleImageAsset asset, java.time.Instant touchedAt);

    ArticleImageAsset retire(ArticleImageAsset asset);

    /** Delete an immutable provider asset ID, never a reusable public ID. */
    void delete(String assetId);

    boolean configured();

    record AssetPage(List<ArticleImageAsset> assets, String nextCursor) {}
}
