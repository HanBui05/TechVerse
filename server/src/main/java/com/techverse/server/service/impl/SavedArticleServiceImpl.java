package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.SavedArticleRow;
import com.techverse.server.dto.request.SavedArticleFilter;
import com.techverse.server.dto.response.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.PublishedArticleRepository;
import com.techverse.server.repository.SavedArticleRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.SavedArticleService;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class SavedArticleServiceImpl implements SavedArticleService {
    private final PublishedArticleRepository articles;
    private final SavedArticleRepository saved;
    private final UserRepository users;

    @Override
    @Transactional
    public SavedArticleStateResponse save(UUID actor, UUID articleId) {
        checkActor(actor);
        if (!articles.isVisible(articleId)) throw new CustomException(ErrorCode.ARTICLE_NOT_FOUND);
        saved.insertIfAbsent(actor, articleId);
        return new SavedArticleStateResponse(true);
    }

    @Override
    @Transactional
    public SavedArticleStateResponse unsave(UUID actor, UUID articleId) {
        checkActor(actor);
        saved.deleteByUserAndArticle(actor, articleId);
        return new SavedArticleStateResponse(false);
    }

    /** One count + one page query + one batched tag lookup, independent of row count. */
    @Override
    @Transactional(readOnly = true)
    public PageResponse<SavedArticleSummaryResponse> list(UUID actor, SavedArticleFilter filter) {
        checkActor(actor);
        var page =
                articles.findSavedPage(
                        actor, filter.getKeyword(), PageRequest.of(filter.getPage(), filter.getSize()));
        var tags = articles.findTags(page.stream().map(row -> row.article().versionId()).toList());
        return PageResponse.from(
                page,
                page.stream()
                        .map(row -> summary(row, tags.getOrDefault(row.article().versionId(), List.of())))
                        .toList());
    }

    /** Same account recheck as public reading: any role, but the account must be active. */
    private void checkActor(UUID actor) {
        var user =
                users.findById(actor)
                        .orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        if (!user.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
    }

    private SavedArticleSummaryResponse summary(
            SavedArticleRow saved, List<ArticleTaxonomyResponse> tags) {
        var row = saved.article();
        return SavedArticleSummaryResponse.builder()
                .id(row.id())
                .title(row.title())
                .summary(row.summary())
                .coverImageUrl(row.coverImageUrl())
                .author(row.author())
                .topic(row.topic())
                .tags(tags)
                .publishedAt(row.publishedAt())
                .approvedAt(row.approvedAt())
                .versionNumber(row.versionNumber())
                .readingMinutes(row.readingMinutes())
                .saved(true)
                .savedAt(saved.savedAt())
                .build();
    }
}
