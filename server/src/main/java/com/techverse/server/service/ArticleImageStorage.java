package com.techverse.server.service;

import com.techverse.server.dto.internal.*;

import java.util.*;

public interface ArticleImageStorage {
    Optional<ArticleImageAsset> find(String publicId);

    ArticleImageAsset upload(String publicId, UUID owner, UUID article, DecodedArticleImage image);

    AssetPage list(String cursor);

    ArticleImageAsset renew(ArticleImageAsset asset, java.time.Instant touchedAt);

    ArticleImageAsset retire(ArticleImageAsset asset);

    /** Delete an immutable provider asset ID, never a reusable public ID. */
    void delete(String assetId);

    boolean configured();

    record AssetPage(List<ArticleImageAsset> assets, String nextCursor) {}
}
