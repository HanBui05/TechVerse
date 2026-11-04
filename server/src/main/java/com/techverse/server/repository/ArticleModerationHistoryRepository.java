package com.techverse.server.repository;

import com.techverse.server.entity.ArticleModerationHistory;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ArticleModerationHistoryRepository
        extends JpaRepository<ArticleModerationHistory, UUID> {
    @EntityGraph(attributePaths = {"actor", "version"})
    @Query(
            value =
                    "select h from ArticleModerationHistory h where h.article.id = :articleId"
                            + " order by h.createdAt desc, h.id desc",
            countQuery =
                    "select count(h) from ArticleModerationHistory h where h.article.id = :articleId")
    Page<ArticleModerationHistory> findPage(@Param("articleId") UUID articleId, Pageable pageable);
}
