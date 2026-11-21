package com.techverse.server.repository;

import com.techverse.server.entity.ForumPost;
import com.techverse.server.enums.ForumPostStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.*;

public interface ForumPostRepository extends JpaRepository<ForumPost, UUID>, JpaSpecificationExecutor<ForumPost> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ForumPost p where p.id=:id")
    Optional<ForumPost> findByIdForUpdate(@Param("id") UUID id);

    /** Empty for a question or a missing id. */
    @Query("select p.parent.id from ForumPost p where p.id=:id")
    Optional<UUID> findParentIdById(@Param("id") UUID id);

    @Override
    @EntityGraph(attributePaths = {"topic", "user"})
    Page<ForumPost> findAll(Specification<ForumPost> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"user"})
    @Query("select p from ForumPost p where p.parent.id=:question and p.status=:status order by p.createdAt, p.id")
    List<ForumPost> findAnswers(@Param("question") UUID question, @Param("status") ForumPostStatus status);

    @Query("select p.parent.id, count(p) from ForumPost p where p.parent.id in :ids and p.status=:status group by p.parent.id")
    List<Object[]> countAnswers(@Param("ids") Collection<UUID> ids, @Param("status") ForumPostStatus status);

    @Query("select count(p) from ForumPost p where p.parent.id=:question and p.status=:status")
    long countAnswers(@Param("question") UUID question, @Param("status") ForumPostStatus status);

    @Query("""
            select count(p) > 0 from ForumPost p
            where p.user.id=:user and p.parent is null and p.status=:status and p.createdAt > :since
              and p.title=:title and p.content=:content""")
    boolean existsRecentQuestion(
            @Param("user") UUID user,
            @Param("title") String title,
            @Param("content") String content,
            @Param("status") ForumPostStatus status,
            @Param("since") Instant since);

    @Query("""
            select count(p) > 0 from ForumPost p
            where p.user.id=:user and p.parent.id=:parent and p.status=:status and p.createdAt > :since
              and p.content=:content""")
    boolean existsRecentAnswer(
            @Param("user") UUID user,
            @Param("parent") UUID parent,
            @Param("content") String content,
            @Param("status") ForumPostStatus status,
            @Param("since") Instant since);
}
