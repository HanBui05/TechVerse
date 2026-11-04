package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.PublishedArticleRow;
import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.PublishedArticleRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.PublishedArticleService;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PublishedArticleServiceImpl implements PublishedArticleService {
    private final PublishedArticleRepository articles;
    private final UserRepository users;

    /** Page visible snapshots, then one batched tag lookup: query count independent of rows. */
    @Override
    public PageResponse<PublishedArticleSummaryResponse> list(
            UUID actor, PublishedArticleFilter filter) {
        checkReader(actor);
        var direction = filter.getSort().getDirection();
        var sort = Sort.by(direction, "publishedAt").and(Sort.by(direction, "id"));
        var page = articles.findPage(actor, filter, PageRequest.of(filter.getPage(), filter.getSize(), sort));
        var tags = articles.findTags(page.stream().map(PublishedArticleRow::versionId).toList());
        return PageResponse.from(
                page,
                page.stream()
                        .map(row -> summary(row, tags.getOrDefault(row.versionId(), List.of())))
                        .toList());
    }

    /** Visible snapshot detail with public author card and related articles. */
    @Override
    public PublishedArticleDetailResponse detail(UUID actor, UUID id) {
        checkReader(actor);
        var row =
                articles.findVisibleById(actor, id)
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_NOT_FOUND));
        var tags = articles.findTags(List.of(row.versionId())).getOrDefault(row.versionId(), List.of());
        var profile = articles.findAuthorProfile(row.author().id()).orElse(new Object[2]);
        return PublishedArticleDetailResponse.builder()
                .id(row.id())
                .title(row.title())
                .summary(row.summary())
                .content(row.content())
                .coverImageUrl(row.coverImageUrl())
                .author(
                        PublishedArticleAuthorResponse.builder()
                                .id(row.author().id())
                                .fullName(row.author().fullName())
                                .avatarUrl(row.author().avatarUrl())
                                .expertise((String) profile[0])
                                .bioExcerpt(PublishedArticleAuthorResponse.excerpt((String) profile[1]))
                                .build())
                .topic(row.topic())
                .tags(tags)
                .publishedAt(row.publishedAt())
                .approvedAt(row.approvedAt())
                .versionNumber(row.versionNumber())
                .readingMinutes(row.readingMinutes())
                .saved(row.saved())
                .relatedArticles(
                        articles.findRelated(
                                actor,
                                id,
                                row.topic().id(),
                                tags.stream().map(ArticleTaxonomyResponse::id).toList()))
                .build();
    }

    /** Taxonomy used by visible snapshots, independently searched/paged. */
    @Override
    public PublishedArticleOptionsResponse options(UUID actor, ArticleOptionsFilter filter) {
        checkReader(actor);
        var topics =
                articles.findTopics(
                        filter.getTopicKeyword(),
                        PageRequest.of(filter.getTopicPage(), filter.getTopicSize()));
        var tags =
                articles.findTags(
                        filter.getTagKeyword(),
                        PageRequest.of(filter.getTagPage(), filter.getTagSize()));
        return PublishedArticleOptionsResponse.builder()
                .topics(PageResponse.from(topics, topics.getContent()))
                .tags(PageResponse.from(tags, tags.getContent()))
                .build();
    }

    /** Recheck the current account; ordinary learners do not need an AuthorProfile to read. */
    private void checkReader(UUID actor) {
        var user =
                users.findById(actor)
                        .orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        if (!user.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
    }

    private PublishedArticleSummaryResponse summary(
            PublishedArticleRow row, List<ArticleTaxonomyResponse> tags) {
        return PublishedArticleSummaryResponse.builder()
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
                .saved(row.saved())
                .build();
    }
}
