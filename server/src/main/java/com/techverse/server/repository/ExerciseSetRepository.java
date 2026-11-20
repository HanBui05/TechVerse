package com.techverse.server.repository;

import com.techverse.server.entity.ExerciseSet;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ExerciseSetRepository extends JpaRepository<ExerciseSet, UUID>, JpaSpecificationExecutor<ExerciseSet> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ExerciseSet s where s.id=:id")
    Optional<ExerciseSet> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select s from ExerciseSet s where s.id=:id")
    Optional<ExerciseSet> findByIdForShare(@Param("id") UUID id);

    @Query("select s.author.id from ExerciseSet s where s.id=:id")
    Optional<UUID> findAuthorIdById(@Param("id") UUID id);

    @Override
    @EntityGraph(attributePaths = {"topic", "author"})
    Page<ExerciseSet> findAll(Specification<ExerciseSet> spec, Pageable pageable);
}
