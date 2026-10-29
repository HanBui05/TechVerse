package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.PublishedArticleRow;
import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.PublishedArticleRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.repository.specification.PublishedArticleSpecification;
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

    /** Apply safe filters and map a metadata page with one batched tag lookup. */
    @Override
    public PageResponse<PublishedArticleSummaryResponse> list(
            UUID actor, PublishedArticleFilter filter) {
        checkReader(actor);
        var sort =
                Sort.by(filter.getDirection(), filter.getSortBy().getProperty())
                        .and(Sort.by(filter.getDirection(), "id"));
        var page =
                articles.findPage(
                        PublishedArticleSpecification.filter(filter),
                        PageRequest.of(filter.getPage(), filter.getSize(), sort));
        var tags =
                articles.findTags(page.getContent().stream().map(PublishedArticleRow::id).toList());
        return PageResponse.from(
                page,
                page.getContent().stream()
                        .map(row -> summary(row, tags.getOrDefault(row.id(), List.of())))
                        .toList());
    }

    /** Enforce published-only detail and append same-topic recommendations without write locks. */
    @Override
    public PublishedArticleDetailResponse detail(UUID actor, UUID id) {
        checkReader(actor);
        var row =
                articles.findPublishedById(id)
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_NOT_FOUND));
        var tags = articles.findTags(List.of(id)).getOrDefault(id, List.of());
        return PublishedArticleDetailResponse.builder()
                .id(row.id())
                .title(row.title())
                .summary(row.summary())
                .content(row.content())
                .coverImageUrl(row.coverImageUrl())
                .author(row.author())
                .topic(row.topic())
                .tags(tags)
                .publishedAt(row.publishedAt())
                .updatedAt(row.updatedAt())
                .relatedArticles(articles.findRelated(id, row.topic().id()))
                .build();
    }

    /** Expose published-used taxonomy independently of author assignment eligibility. */
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

    /** Map only public list fields; never expose Markdown or moderation/private account data. */
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
                .updatedAt(row.updatedAt())
                .build();
    }
}
