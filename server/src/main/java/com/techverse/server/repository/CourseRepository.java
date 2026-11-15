package com.techverse.server.repository;

import com.techverse.server.entity.Course;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface CourseRepository extends JpaRepository<Course, UUID>, JpaSpecificationExecutor<Course> {
    /** Single lock for the whole course tree (chapters, lessons, tags, cleanup). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Course c where c.id=:id")
    Optional<Course> findByIdForUpdate(@Param("id") UUID id);

    /**
     * Price-only write: bypasses entity auditing and (by trigger) leaves updated_at alone, so it does not
     * stale a moderator review token. Callers hold the row lock and refresh the entity afterwards.
     */
    @Modifying
    @Query("update Course c set c.priceAmount = :amount where c.id = :id")
    int updatePrice(@Param("id") UUID id, @Param("amount") long amount);

    /** The single active policy (unique partial index); Authors see it to estimate their share. */
    @Query(value = "select rate_bps from commission_policies where is_active", nativeQuery = true)
    Optional<Integer> activeCommissionRateBps();

    /** Waits for a running review/publication change so progress is written against the new snapshot. */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select c from Course c where c.id=:id")
    Optional<Course> findByIdForShare(@Param("id") UUID id);

    /** Lists (author, moderator, reader) render the snapshot, topic and author of every row. */
    @Override
    @EntityGraph(attributePaths = {"topic", "author", "publishedVersion", "publishedVersion.topic"})
    org.springframework.data.domain.Page<Course> findAll(
            org.springframework.data.jpa.domain.Specification<Course> spec,
            org.springframework.data.domain.Pageable pageable);

    @Query("select c.author.id from Course c where c.id=:id")
    Optional<UUID> findAuthorIdById(@Param("id") UUID id);
}
