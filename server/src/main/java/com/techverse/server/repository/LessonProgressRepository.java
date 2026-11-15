package com.techverse.server.repository;

import com.techverse.server.entity.LessonProgress;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

public interface LessonProgressRepository extends JpaRepository<LessonProgress, UUID> {
    @Modifying
    @Query(
            value =
                    "INSERT INTO lesson_progress (user_id, lesson_id) VALUES (:userId, :lessonId)"
                            + " ON CONFLICT (user_id, lesson_id) DO NOTHING",
            nativeQuery = true)
    int complete(@Param("userId") UUID userId, @Param("lessonId") UUID lessonId);

    @Modifying
    @Query("delete from LessonProgress p where p.userId = :userId and p.lessonId = :lessonId")
    int uncomplete(@Param("userId") UUID userId, @Param("lessonId") UUID lessonId);

    @Query("select p.lessonId from LessonProgress p where p.userId = :userId and p.lessonId in :lessonIds")
    Set<UUID> findCompleted(@Param("userId") UUID userId, @Param("lessonIds") Collection<UUID> lessonIds);
}
