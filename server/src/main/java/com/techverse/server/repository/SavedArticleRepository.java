package com.techverse.server.repository;

import com.techverse.server.entity.SavedArticle;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface SavedArticleRepository extends JpaRepository<SavedArticle, UUID> {
    /** Idempotent and race-safe: a concurrent duplicate hits the unique key and is a no-op. */
    @Modifying
    @Query(
            value =
                    "INSERT INTO techverse.saved_articles(user_id, article_id, created_by,"
                            + " updated_by) VALUES (:user, :article, :user, :user)"
                            + " ON CONFLICT (user_id, article_id) DO NOTHING",
            nativeQuery = true)
    void insertIfAbsent(@Param("user") UUID user, @Param("article") UUID article);

    @Modifying
    @Query(
            value = "DELETE FROM techverse.saved_articles WHERE user_id = :user AND article_id = :article",
            nativeQuery = true)
    void deleteByUserAndArticle(@Param("user") UUID user, @Param("article") UUID article);
}
