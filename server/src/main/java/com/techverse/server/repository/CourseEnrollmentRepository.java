package com.techverse.server.repository;

import com.techverse.server.entity.CourseEnrollment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CourseEnrollmentRepository
        extends JpaRepository<CourseEnrollment, UUID>, JpaSpecificationExecutor<CourseEnrollment> {
    /** Idempotent under concurrency: the partial unique index keeps one active row per user/course. */
    @Modifying
    @Query(
            value =
                    "INSERT INTO course_enrollments (user_id, course_id, source) VALUES (:userId, :courseId, 'FREE')"
                            + " ON CONFLICT (user_id, course_id) WHERE revoked_at IS NULL DO NOTHING",
            nativeQuery = true)
    int insertFree(@Param("userId") UUID userId, @Param("courseId") UUID courseId);

    @Query("select e from CourseEnrollment e where e.userId = :userId and e.course.id = :courseId and e.revokedAt is null")
    Optional<CourseEnrollment> findActive(@Param("userId") UUID userId, @Param("courseId") UUID courseId);

    @Modifying
    @Query(
            "update CourseEnrollment e set e.lastLessonId = :lessonId, e.lastAccessedAt = CURRENT_TIMESTAMP"
                    + " where e.id = :id")
    int touch(@Param("id") UUID id, @Param("lessonId") UUID lessonId);

    @Override
    @EntityGraph(attributePaths = {"course", "course.publishedVersion", "course.publishedVersion.topic", "course.author"})
    Page<CourseEnrollment> findAll(Specification<CourseEnrollment> spec, Pageable pageable);
}
