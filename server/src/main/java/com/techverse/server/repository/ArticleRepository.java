package com.techverse.server.repository;

import com.techverse.server.entity.Article;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ArticleRepository
        extends JpaRepository<Article, UUID>, JpaSpecificationExecutor<Article> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Article a where a.id=:id")
    Optional<Article> findByIdForUpdate(@Param("id") UUID id);
}
