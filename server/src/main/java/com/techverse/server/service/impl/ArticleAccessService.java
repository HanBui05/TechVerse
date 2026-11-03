package com.techverse.server.service.impl;

import com.techverse.server.entity.*;
import com.techverse.server.enums.*;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ArticleAccessService {
    private final UserRepository users;
    private final AuthorProfileRepository profiles;
    private final ArticleRepository articles;
    private final jakarta.persistence.EntityManager entityManager;

    /** Must be invoked inside a transaction, before locking Article/Topic/Tags. */
    public User lockWriter(UUID actor) {
        User user =
                users.findByIdForAuthentication(actor)
                        .orElseThrow(() -> new CustomException(ErrorCode.ACCESS_DENIED));
        // OSIV can retain entities across the two upload transactions. A lock query alone
        // does not overwrite managed state after another transaction changes it.
        entityManager.refresh(user);
        if (!user.isActive()) throw new CustomException(ErrorCode.ACCESS_DENIED);
        var profile =
                profiles.findByUserIdForResubmit(actor)
                        .orElseThrow(() -> new CustomException(ErrorCode.ACCESS_DENIED));
        entityManager.refresh(profile);
        if (profile.getStatus() != AuthorProfileStatus.APPROVED
                || user.getUserRoles().stream()
                        .noneMatch(a -> a.getRole().getName() == RoleName.AUTHOR))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        return user;
    }

    public void checkReader(UUID actor) {
        var user =
                users.findById(actor)
                        .orElseThrow(() -> new CustomException(ErrorCode.ACCESS_DENIED));
        if (!user.isActive() || !profiles.existsByUser_Id(actor))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
    }

    /** Active account only; a suspended Author keeps this (e.g. to delete own articles). */
    public User lockActiveUser(UUID actor) {
        User user =
                users.findByIdForAuthentication(actor)
                        .orElseThrow(() -> new CustomException(ErrorCode.ACCESS_DENIED));
        entityManager.refresh(user);
        if (!user.isActive()) throw new CustomException(ErrorCode.ACCESS_DENIED);
        return user;
    }

    /** Locks the actor's own article; soft-deleted ones no longer exist for the author. */
    public Article lockOwned(UUID actor, UUID id) {
        Article article =
                articles.findByIdForUpdate(id)
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_NOT_FOUND));
        entityManager.refresh(article);
        if (!isOwnedVisible(article, actor)) throw new CustomException(ErrorCode.ARTICLE_NOT_FOUND);
        return article;
    }

    public Article lockEditable(UUID actor, UUID id) {
        Article article = lockOwned(actor, id);
        article.ensureEditable();
        return article;
    }

    public boolean isOwnedVisible(Article article, UUID actor) {
        return article.getAuthor().getId().equals(actor)
                && article.getPublicationStatus() != ArticlePublicationStatus.AUTHOR_DELETED;
    }
}
