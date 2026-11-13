package com.techverse.server.repository;

import com.techverse.server.entity.CourseModerationHistory;

import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface CourseModerationHistoryRepository
        extends JpaRepository<CourseModerationHistory, UUID> {
    @EntityGraph(attributePaths = {"actor", "version"})
    @Query(
            value =
                    "select h from CourseModerationHistory h where h.course.id = :courseId"
                            + " order by h.createdAt desc, h.id desc",
            countQuery =
                    "select count(h) from CourseModerationHistory h where h.course.id = :courseId")
    Page<CourseModerationHistory> findPage(@Param("courseId") UUID courseId, Pageable pageable);
}
