package com.techverse.server.service;

import com.techverse.server.dto.request.SavedArticleFilter;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.dto.response.SavedArticleStateResponse;
import com.techverse.server.dto.response.SavedArticleSummaryResponse;

import java.util.UUID;

public interface SavedArticleService {
    /** Idempotently save a currently visible article for the active actor. */
    SavedArticleStateResponse save(UUID actor, UUID articleId);

    /** Idempotently remove the actor's row, whatever the article's current state. */
    SavedArticleStateResponse unsave(UUID actor, UUID articleId);

    /** Page the actor's saved articles that are visible now, newest save first. */
    PageResponse<SavedArticleSummaryResponse> list(UUID actor, SavedArticleFilter filter);
}
