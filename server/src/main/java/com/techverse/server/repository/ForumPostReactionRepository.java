package com.techverse.server.repository;

import com.techverse.server.entity.ForumPostReaction;
import com.techverse.server.enums.ForumReactionType;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ForumPostReactionRepository extends JpaRepository<ForumPostReaction, UUID> {
    /**
     * Creates or switches the reaction; the same type again changes nothing, so updated_at stays.
     * clock_timestamp(), not now(): the request may have waited on a lock since its transaction began.
     */
    @Modifying(clearAutomatically = true)
    @Query(
            value = "INSERT INTO forum_post_reactions AS r (user_id, post_id, type, created_at, updated_at)"
                    + " VALUES (:user, :post, :type, clock_timestamp(), clock_timestamp())"
                    + " ON CONFLICT (user_id, post_id) DO UPDATE SET type = EXCLUDED.type, updated_at = EXCLUDED.updated_at"
                    + " WHERE r.type <> EXCLUDED.type",
            nativeQuery = true)
    int upsert(@Param("user") UUID user, @Param("post") UUID post, @Param("type") String type);

    @Modifying(clearAutomatically = true)
    @Query("delete from ForumPostReaction r where r.user.id = :user and r.post.id = :post")
    int remove(@Param("user") UUID user, @Param("post") UUID post);

    /** Rows of (post id, type, count). */
    @Query("select r.post.id, r.type, count(r) from ForumPostReaction r where r.post.id in :posts group by r.post.id, r.type")
    List<Object[]> countByType(@Param("posts") Collection<UUID> posts);

    /** Rows of (post id, total). */
    @Query("select r.post.id, count(r) from ForumPostReaction r where r.post.id in :posts group by r.post.id")
    List<Object[]> countTotal(@Param("posts") Collection<UUID> posts);

    /** Rows of (post id, type) for one user. */
    @Query("select r.post.id, r.type from ForumPostReaction r where r.user.id = :user and r.post.id in :posts")
    List<Object[]> findMine(@Param("user") UUID user, @Param("posts") Collection<UUID> posts);

    @EntityGraph(attributePaths = "user")
    Page<ForumPostReaction> findByPostId(UUID post, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<ForumPostReaction> findByPostIdAndType(UUID post, ForumReactionType type, Pageable pageable);
}
