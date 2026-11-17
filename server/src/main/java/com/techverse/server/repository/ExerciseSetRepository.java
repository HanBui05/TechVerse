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

    @Override
    @EntityGraph(attributePaths = {"topic"})
    Page<ExerciseSet> findAll(Specification<ExerciseSet> spec, Pageable pageable);
}
