package com.techverse.server.service.impl;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.ModeratorArticleSpecification;
import com.techverse.server.service.ModeratorArticleService;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ModeratorArticleServiceImpl implements ModeratorArticleService {
    private final ArticleRepository articles;
    private final UserRepository users;
    private final AuthorProfileRepository profiles;
    private final TopicRepository topics;
    private final TagRepository tags;
    private final EntityManager entityManager;
    private final ObjectMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ModeratorArticleSummaryResponse> list(
            UUID actor, ModeratorArticleFilter f) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        if (f.getStatus() == ArticleStatus.DRAFT
                || (f.getCreatedFrom() != null
                        && f.getCreatedTo() != null
                        && f.getCreatedFrom().isAfter(f.getCreatedTo()))) {
            throw new CustomException(ErrorCode.VALIDATION_ERROR);
        }
        var sort =
                Sort.by(f.getDirection(), f.getSortBy().getProperty())
                        .and(Sort.by(f.getDirection(), "id"));
        var page =
                articles.findAll(
                        ModeratorArticleSpecification.filter(f),
                        PageRequest.of(f.getPage(), f.getSize(), sort));
        return PageResponse.from(page, page.getContent().stream().map(this::summary).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ModeratorArticleDetailResponse detail(UUID actor, UUID id) {
        checkModerator(users.findWithRolesById(actor).orElse(null));
        Article article =
                articles.findById(id)
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_NOT_FOUND));
        ensureVisible(article);
        return detailResponse(article);
    }

    @Override
    @Transactional
    public ModeratorArticleDetailResponse review(UUID actorId, UUID id, ReviewArticleRequest r) {
        UUID authorId =
                articles.findAuthorIdById(id)
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_NOT_FOUND));
        if (actorId.equals(authorId))
            throw new CustomException(ErrorCode.ARTICLE_SELF_REVIEW_NOT_ALLOWED);

        // Same lock hierarchy as author writes and administrative account/profile updates.
        // The scalar lookup above deliberately avoids loading an unlocked stale Article.
        var lockedUsers =
                users.findAllByIdForAdminStatusUpdate(List.of(actorId, authorId)).stream()
                        .collect(Collectors.toMap(User::getId, Function.identity()));
        lockedUsers.values().forEach(entityManager::refresh);
        User actor = lockedUsers.get(actorId);
        User author = lockedUsers.get(authorId);
        checkModerator(actor);
        if (author == null) throw new CustomException(ErrorCode.ARTICLE_NOT_FOUND);
        var profile = profiles.findByUserIdForResubmit(authorId).orElse(null);
        if (profile != null) entityManager.refresh(profile);

        Article article =
                articles.findByIdForUpdate(id)
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_NOT_FOUND));
        entityManager.refresh(article);
        ensureVisible(article);
        if (!article.getAuthor().getId().equals(authorId))
            throw new CustomException(ErrorCode.ARTICLE_REVIEW_STALE);
        if (article.getStatus() != ArticleStatus.PENDING)
            throw new CustomException(ErrorCode.ARTICLE_NOT_PENDING);
        if (!reviewToken(article).equals(r.reviewToken()))
            throw new CustomException(ErrorCode.ARTICLE_REVIEW_STALE);

        String note = r.moderationNote() == null ? null : r.moderationNote().strip();
        if (note != null && note.isBlank()) note = null;
        if (r.decision() == ArticleReviewDecision.REQUEST_CHANGES && note == null)
            throw new CustomException(ErrorCode.ARTICLE_REVIEW_NOTE_REQUIRED);

        if (r.decision() == ArticleReviewDecision.APPROVE) {
            if (!author.isActive()
                    || !hasRole(author, RoleName.AUTHOR)
                    || profile == null
                    || profile.getStatus() != AuthorProfileStatus.APPROVED)
                throw new CustomException(ErrorCode.ARTICLE_AUTHOR_INELIGIBLE);
            lockActiveAssociations(article);
        }
        article.review(
                r.decision() == ArticleReviewDecision.APPROVE
                        ? ArticleStatus.PUBLISHED
                        : ArticleStatus.CHANGES_REQUESTED,
                actor,
                note,
                Instant.now());
        articles.flush();
        // Database triggers own updated_at; return a fingerprint of persisted precision/state.
        entityManager.refresh(article);
        return detailResponse(article);
    }

    private void lockActiveAssociations(Article article) {
        Topic topic =
                topics.findByIdForUpdate(article.getTopic().getId())
                        .orElseThrow(() -> new CustomException(ErrorCode.TOPIC_NOT_FOUND));
        entityManager.refresh(topic);
        if (!topic.isActive()) throw new CustomException(ErrorCode.ARTICLE_ASSOCIATION_INACTIVE);
        var ids =
                article.getArticleTags().stream()
                        .map(link -> link.getTag().getId())
                        .sorted(Comparator.comparing(UUID::toString))
                        .toList();
        for (UUID id : ids) {
            com.techverse.server.entity.Tag tag =
                    tags.findByIdForUpdate(id)
                            .orElseThrow(() -> new CustomException(ErrorCode.TAG_NOT_FOUND));
            entityManager.refresh(tag);
            if (!tag.isActive()) throw new CustomException(ErrorCode.ARTICLE_ASSOCIATION_INACTIVE);
        }
    }

    private void checkModerator(User user) {
        if (user == null || !user.isActive() || !hasRole(user, RoleName.MODERATOR))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
    }

    private boolean hasRole(User user, RoleName role) {
        return user.getUserRoles().stream().anyMatch(link -> link.getRole().getName() == role);
    }

    private void ensureVisible(Article article) {
        if (article.getStatus() == ArticleStatus.DRAFT)
            throw new CustomException(ErrorCode.ARTICLE_NOT_FOUND);
    }

    /** Snapshot, not an authentication token. Includes last review to prevent resubmission ABA. */
    private String reviewToken(Article a) {
        var snapshot = new TreeMap<String, Object>();
        snapshot.put("id", a.getId());
        snapshot.put("authorId", a.getAuthor().getId());
        snapshot.put("updatedAt", a.getUpdatedAt());
        snapshot.put("status", a.getStatus());
        snapshot.put("title", a.getTitle());
        snapshot.put("summary", a.getSummary());
        snapshot.put("content", a.getContent());
        snapshot.put("coverImageUrl", a.getCoverImageUrl());
        snapshot.put("topicId", a.getTopic().getId());
        snapshot.put(
                "tagIds",
                a.getArticleTags().stream()
                        .map(t -> t.getTag().getId().toString())
                        .sorted()
                        .toList());
        snapshot.put("reviewedBy", a.getReviewedBy() == null ? null : a.getReviewedBy().getId());
        snapshot.put("reviewedAt", a.getReviewedAt());
        snapshot.put("moderationNote", a.getModerationNote());
        snapshot.put("publishedAt", a.getPublishedAt());
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(
                                            mapper.writeValueAsString(snapshot)
                                                    .getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private ArticleAuthorResponse author(User user) {
        return ArticleAuthorResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    private ArticleOptionResponse topic(Topic topic) {
        return ArticleOptionResponse.builder()
                .id(topic.getId())
                .name(topic.getName())
                .active(topic.isActive())
                .build();
    }

    private ModeratorArticleSummaryResponse summary(Article a) {
        return ModeratorArticleSummaryResponse.builder()
                .id(a.getId())
                .title(a.getTitle())
                .summary(a.getSummary())
                .coverImageUrl(a.getCoverImageUrl())
                .author(author(a.getAuthor()))
                .topic(topic(a.getTopic()))
                .status(a.getStatus())
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .build();
    }

    private ModeratorArticleDetailResponse detailResponse(Article a) {
        var response =
                ArticleResponse.builder()
                        .id(a.getId())
                        .authorId(a.getAuthor().getId())
                        .title(a.getTitle())
                        .summary(a.getSummary())
                        .content(a.getContent())
                        .coverImageUrl(a.getCoverImageUrl())
                        .topic(topic(a.getTopic()))
                        .tags(
                                a.getArticleTags().stream()
                                        .map(
                                                t ->
                                                        ArticleOptionResponse.builder()
                                                                .id(t.getTag().getId())
                                                                .name(t.getTag().getName())
                                                                .active(t.getTag().isActive())
                                                                .build())
                                        .toList())
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
        return ModeratorArticleDetailResponse.builder()
                .article(response)
                .author(author(a.getAuthor()))
                .reviewToken(reviewToken(a))
                .build();
    }
}
