package com.techverse.server.repository;

import com.techverse.server.entity.ExerciseAttempt;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ExerciseAttemptRepository extends JpaRepository<ExerciseAttempt, UUID> {
    @EntityGraph(attributePaths = {"exerciseSet"})
    Optional<ExerciseAttempt> findByUserIdAndIdempotencyKey(UUID userId, UUID key);

    Optional<ExerciseAttempt> findByIdAndUserId(UUID id, UUID userId);

    Page<ExerciseAttempt> findByUserId(UUID userId, Pageable pageable);

    Page<ExerciseAttempt> findByUserIdAndExerciseSetId(UUID userId, UUID setId, Pageable pageable);

    @Query("select a from ExerciseAttempt a where a.user.id=:user and a.exerciseSet.id in :ids"
            + " and a.completedAt = (select max(b.completedAt) from ExerciseAttempt b"
            + " where b.user.id=a.user.id and b.exerciseSet.id=a.exerciseSet.id)")
    List<ExerciseAttempt> latestFor(@Param("user") UUID user, @Param("ids") Collection<UUID> ids);
}
