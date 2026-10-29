package com.techverse.server.service;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;

import java.util.UUID;

public interface AuthorArticleService {
    ArticleResponse create(UUID actor, UUID key, ArticleWriteRequest request);

    ArticleResponse update(UUID actor, UUID id, ArticleWriteRequest request);

    ArticleResponse detail(UUID actor, UUID id);

    PageResponse<ArticleSummaryResponse> list(UUID actor, ArticleFilter filter);

    ArticleOptionsResponse options(UUID actor, ArticleOptionsFilter filter);
}
