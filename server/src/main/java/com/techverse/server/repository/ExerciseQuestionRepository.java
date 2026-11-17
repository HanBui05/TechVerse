package com.techverse.server.repository;

import com.techverse.server.entity.ExerciseQuestion;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ExerciseQuestionRepository extends JpaRepository<ExerciseQuestion, UUID> {
    List<ExerciseQuestion> findByExerciseSetIdOrderByPositionAsc(UUID setId);

    long countByExerciseSetId(UUID setId);

    @Query("select q.exerciseSet.id, count(q) from ExerciseQuestion q where q.exerciseSet.id in :ids group by q.exerciseSet.id")
    List<Object[]> countBySets(@Param("ids") Collection<UUID> ids);

    /** Bulk delete runs immediately, so replacements can reuse positions (unique per set). */
    @Modifying(flushAutomatically = true)
    @Query("delete from ExerciseQuestion q where q.exerciseSet.id=:id")
    void deleteBySet(@Param("id") UUID id);
}
