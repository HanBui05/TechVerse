package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.ArticleCreationReceipt;
import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.ArticleAction;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.*;
import com.techverse.server.service.AuthorArticleService;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthorArticleServiceImpl implements AuthorArticleService {
    private final ArticleRepository articles;
    private final TopicRepository topics;
    private final TagRepository tags;
    private final ArticleAccessService access;
    private final ArticleContentService contentService;
    private final ArticleImageService imageService;
    private final ArticleCreationRepository receipts;
    private final PlatformTransactionManager transactionManager;
    private final EntityManager em;
    private final ObjectMapper mapper;

    @Override
    public ArticleResponse create(UUID actor, UUID key, ArticleWriteRequest request) {
        String fingerprint = fingerprint(request);
        var tx = new TransactionTemplate(transactionManager);
        tx.setTimeout(45);
        ArticleResponse result =
                tx.execute(
                        status -> {
                            User author = access.lockWriter(actor);
                            var previous = receipts.find(actor, key);
                            if (previous != null) {
                                if (!previous.fingerprint().equals(fingerprint))
                                    throw new CustomException(ErrorCode.ARTICLE_KEY_CONFLICT);
                                if (previous.articleId() != null
                                        && articles.existsById(previous.articleId())) {
                                    if (previous.response() == null)
                                        throw new CustomException(
                                                ErrorCode.ARTICLE_REQUEST_IN_PROGRESS);
                                    return previous.response();
                                }
                            }
                            if (request.getTitle() == null || request.getTopicId() == null)
                                invalid();
                            if (request.getCoverImageUrl() != null)
                                throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
                            Topic topic = lockTopic(request.getTopicId());
                            if (!topic.isActive()) inactive();
                            List<Tag> selected =
                                    lockTags(
                                            request.getTagIds() == null
                                                    ? List.of()
                                                    : request.getTagIds());
                            if (selected.stream().anyMatch(t -> !t.isActive())) inactive();
                            Article article =
                                    Article.builder()
                                            .author(author)
                                            .topic(topic)
                                            .title(request.getTitle())
                                            .summary(
                                                    request.getSummary() == null
                                                            ? ""
                                                            : request.getSummary())
                                            .content(
                                                    request.getContent() == null
                                                            ? ""
                                                            : request.getContent())
                                            .build();
                            article.replaceTags(selected);
                            validateFinal(article, request.getAction());
                            if (request.getAction() == ArticleAction.SUBMIT) article.submit();
                            articles.saveAndFlush(article);
                            em.refresh(article);
                            ArticleResponse response = toResponse(article);
                            // Store the generated ID and immutable creation response BEFORE
                            // database commit.
                            receipts.save(
                                    actor,
                                    key,
                                    ArticleCreationReceipt.builder()
                                            .fingerprint(fingerprint)
                                            .articleId(article.getId())
                                            .response(response)
                                            .complete(false)
                                            .build());
                            return response;
                        });
        try {
            receipts.save(
                    actor,
                    key,
                    ArticleCreationReceipt.builder()
                            .fingerprint(fingerprint)
                            .articleId(result.id())
                            .response(result)
                            .complete(true)
                            .build());
        } catch (CustomException e) {
            log.warn("Article creation committed; pending receipt will be recovered on retry");
        }
        return result;
    }

    @Override
    @Transactional(timeout = 45)
    public ArticleResponse update(UUID actor, UUID id, ArticleWriteRequest request) {
        access.lockWriter(actor);
        Article article = access.lockEditable(actor, id);
        if (request.getAction() == ArticleAction.SAVE && request.getProvided().isEmpty()) invalid();
        UUID topicId = request.has("topicId") ? request.getTopicId() : article.getTopic().getId();
        Topic topic = lockTopic(topicId);
        if (!topic.isActive() && !topicId.equals(article.getTopic().getId())) inactive();
        List<UUID> oldTags =
                article.getArticleTags().stream().map(t -> t.getTag().getId()).toList();
        List<Tag> selected = lockTags(request.has("tagIds") ? request.getTagIds() : oldTags);
        if (selected.stream().anyMatch(t -> !t.isActive() && !oldTags.contains(t.getId())))
            inactive();
        article.edit(
                topic,
                request.has("title") ? request.getTitle() : article.getTitle(),
                request.has("summary") ? request.getSummary() : article.getSummary(),
                request.has("content") ? request.getContent() : article.getContent(),
                request.has("coverImageUrl")
                        ? request.getCoverImageUrl()
                        : article.getCoverImageUrl());
        article.replaceTags(selected);
        validateFinal(article, request.getAction());
        if (request.getAction() == ArticleAction.SUBMIT) article.submit();
        articles.flush();
        em.refresh(article);
        return toResponse(article);
    }

    @Override
    @Transactional(readOnly = true)
    public ArticleResponse detail(UUID actor, UUID id) {
        access.checkReader(actor);
        var a =
                articles.findById(id)
                        .filter(v -> v.getAuthor().getId().equals(actor))
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_NOT_FOUND));
        return toResponse(a);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ArticleSummaryResponse> list(UUID actor, ArticleFilter filter) {
        access.checkReader(actor);
        Sort sort =
                Sort.by(filter.getDirection(), filter.getSortBy().getProperty())
                        .and(Sort.by(filter.getDirection(), "id"));
        var page =
                articles.findAll(
                        ArticleSpecification.filter(actor, filter),
                        PageRequest.of(filter.getPage(), filter.getSize(), sort));
        return PageResponse.from(
                page,
                page.stream()
                        .map(
                                a ->
                                        ArticleSummaryResponse.builder()
                                                .id(a.getId())
                                                .title(a.getTitle())
                                                .summary(a.getSummary())
                                                .coverImageUrl(a.getCoverImageUrl())
                                                .topic(option(a.getTopic()))
                                                .status(a.getStatus())
                                                .createdAt(a.getCreatedAt())
                                                .updatedAt(a.getUpdatedAt())
                                                .build())
                        .toList());
    }

    @Override
    @Transactional
    public ArticleOptionsResponse options(UUID actor, ArticleOptionsFilter f) {
        access.lockWriter(actor);
        var topicPage =
                topics.findAll(
                        TopicSpecification.hasKeyword(f.getTopicKeyword())
                                .and(TopicSpecification.hasActiveStatus(true)),
                        PageRequest.of(f.getTopicPage(), f.getTopicSize(), Sort.by("name", "id")));
        var tagPage =
                tags.findAll(
                        TagSpecification.hasKeyword(f.getTagKeyword())
                                .and(TagSpecification.hasActiveStatus(true)),
                        PageRequest.of(f.getTagPage(), f.getTagSize(), Sort.by("name", "id")));
        return ArticleOptionsResponse.builder()
                .topics(PageResponse.from(topicPage, topicPage.stream().map(this::option).toList()))
                .tags(PageResponse.from(tagPage, tagPage.stream().map(this::option).toList()))
                .build();
    }

    private Topic lockTopic(UUID id) {
        return topics.findByIdForUpdate(id)
                .orElseThrow(() -> new CustomException(ErrorCode.TOPIC_NOT_FOUND));
    }

    private List<Tag> lockTags(List<UUID> ids) {
        if (ids.size() > 10 || new HashSet<>(ids).size() != ids.size()) invalid();
        return ids.stream()
                .sorted(Comparator.comparing(UUID::toString))
                .map(
                        id ->
                                tags.findByIdForUpdate(id)
                                        .orElseThrow(
                                                () -> new CustomException(ErrorCode.TAG_NOT_FOUND)))
                .toList();
    }

    private void validateFinal(Article a, ArticleAction action) {
        if (a.getTitle() == null
                || a.getTitle().isBlank()
                || a.getTitle().length() > 255
                || a.getSummary().length() > 500) invalid();
        contentService.validateContent(a.getContent());
        imageService.validateReferences(a);
        if (action == ArticleAction.SUBMIT) {
            if (a.getSummary().isBlank() || a.getContent().isBlank()) invalid();
            if (!a.getTopic().isActive()
                    || a.getArticleTags().stream().anyMatch(t -> !t.getTag().isActive()))
                inactive();
        }
    }

    private String fingerprint(ArticleWriteRequest r) {
        var payload = new TreeMap<String, Object>();
        payload.put("action", r.getAction());
        payload.put("title", r.getTitle());
        payload.put("topicId", r.getTopicId());
        payload.put(
                "tagIds",
                r.getTagIds() == null
                        ? List.of()
                        : r.getTagIds().stream()
                                .sorted(Comparator.comparing(UUID::toString))
                                .toList());
        payload.put("summary", r.getSummary() == null ? "" : r.getSummary());
        payload.put("content", r.getContent() == null ? "" : r.getContent());
        payload.put("coverImageUrl", r.getCoverImageUrl());
        try {
            return java.util.HexFormat.of()
                    .formatHex(
                            java.security.MessageDigest.getInstance("SHA-256")
                                    .digest(
                                            mapper.writeValueAsString(payload)
                                                    .getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private void invalid() {
        throw new CustomException(ErrorCode.VALIDATION_ERROR);
    }

    private void inactive() {
        throw new CustomException(ErrorCode.ARTICLE_ASSOCIATION_INACTIVE);
    }

    private ArticleOptionResponse option(Topic t) {
        return ArticleOptionResponse.builder()
                .id(t.getId())
                .name(t.getName())
                .active(t.isActive())
                .build();
    }

    private ArticleOptionResponse option(Tag t) {
        return ArticleOptionResponse.builder()
                .id(t.getId())
                .name(t.getName())
                .active(t.isActive())
                .build();
    }

    private ArticleResponse toResponse(Article a) {
        return ArticleResponse.builder()
                .id(a.getId())
                .authorId(a.getAuthor().getId())
                .title(a.getTitle())
                .summary(a.getSummary())
                .content(a.getContent())
                .coverImageUrl(a.getCoverImageUrl())
                .topic(option(a.getTopic()))
                .tags(a.getArticleTags().stream().map(t -> option(t.getTag())).toList())
                .status(a.getStatus())
                .moderationNote(a.getModerationNote())
                .reviewedBy(a.getReviewedBy() == null ? null : a.getReviewedBy().getId())
                .reviewedAt(a.getReviewedAt())
                .publishedAt(a.getPublishedAt())
                .createdAt(a.getCreatedAt())
                .createdBy(a.getCreatedBy())
                .updatedAt(a.getUpdatedAt())
                .updatedBy(a.getUpdatedBy())
                .build();
    }
}
