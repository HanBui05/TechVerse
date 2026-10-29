package com.techverse.server.service;

import com.techverse.server.dto.request.ArticleOptionsFilter;
import com.techverse.server.dto.request.PublishedArticleFilter;
import com.techverse.server.dto.response.*;

import java.util.UUID;

public interface PublishedArticleService {
    /** List published article metadata for an active authenticated reader. */
    PageResponse<PublishedArticleSummaryResponse> list(UUID actor, PublishedArticleFilter filter);

    /** Read one published article and its related recommendations. */
    PublishedArticleDetailResponse detail(UUID actor, UUID id);

    /** Retrieve independently paginated reader topic/tag filter options. */
    PublishedArticleOptionsResponse options(UUID actor, ArticleOptionsFilter filter);
}
