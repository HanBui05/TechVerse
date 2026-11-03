package com.techverse.server.repository;

import com.techverse.server.entity.ArticlePublicationVersion;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ArticlePublicationVersionRepository
        extends JpaRepository<ArticlePublicationVersion, UUID> {
    /** Content and cover of every snapshot of an article, for image cleanup reference checks. */
    @Query(
            "select v.content, v.coverImageUrl from ArticlePublicationVersion v"
                    + " where v.article.id = :articleId")
    List<Object[]> findImageSources(@Param("articleId") UUID articleId);
}
