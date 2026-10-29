package com.techverse.server.service;

import com.techverse.server.dto.request.ModeratorArticleFilter;
import com.techverse.server.dto.request.ReviewArticleRequest;
import com.techverse.server.dto.response.*;

import java.util.UUID;

public interface ModeratorArticleService {
    PageResponse<ModeratorArticleSummaryResponse> list(UUID actor, ModeratorArticleFilter filter);

    ModeratorArticleDetailResponse detail(UUID actor, UUID id);

    ModeratorArticleDetailResponse review(UUID actor, UUID id, ReviewArticleRequest request);
}
