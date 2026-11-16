package com.techverse.server.repository;

import com.techverse.server.entity.CourseEnrollment;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
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

    /** Active students of a course with progress on one published version; {@code :q} is '' for no filter; ICU collation lowercases Vietnamese capitals even in a C-locale database. */
    String STUDENTS =
            "select u.full_name as \"fullName\", u.avatar_url as \"avatarUrl\", e.granted_at as \"enrolledAt\","
                    + " e.last_accessed_at as \"lastAccessedAt\", e.id as \"id\","
                    + " (select count(*) from lesson_progress p join course_publication_version_lessons vl"
                    + "   on vl.lesson_id = p.lesson_id where p.user_id = e.user_id and vl.version_id = :versionId)"
                    + "   as \"completedLessons\","
                    + " (select count(*) from course_publication_version_lessons where version_id = :versionId)"
                    + "   as \"totalLessons\""
                    + " from course_enrollments e join users u on u.id = e.user_id"
                    + " where e.course_id = :courseId and e.revoked_at is null"
                    + " and (:q = '' or strpos(lower(u.full_name collate \"und-x-icu\"), lower(cast(:q as text) collate \"und-x-icu\")) > 0)";

    String PROGRESS_FILTER =
            " where (:progress = '' or (:progress = 'NOT_STARTED' and s.\"completedLessons\" = 0)"
                    + " or (:progress = 'IN_PROGRESS' and s.\"completedLessons\" > 0"
                    + "   and s.\"completedLessons\" < s.\"totalLessons\")"
                    + " or (:progress = 'COMPLETED' and s.\"totalLessons\" > 0"
                    + "   and s.\"completedLessons\" = s.\"totalLessons\"))";

    @Query(
            value = "select * from (" + STUDENTS + ") s" + PROGRESS_FILTER + " order by s.\"enrolledAt\" desc, s.\"id\"",
            countQuery = "select count(*) from (" + STUDENTS + ") s" + PROGRESS_FILTER,
            nativeQuery = true)
    Page<StudentRow> findStudents(
            @Param("courseId") UUID courseId,
            @Param("versionId") UUID versionId,
            @Param("q") String q,
            @Param("progress") String progress,
            Pageable pageable);

    /** Unfiltered counts for the summary strip. */
    @Query(
            value = "select count(*) as \"total\","
                    + " count(*) filter (where s.\"completedLessons\" = 0) as \"notStarted\","
                    + " count(*) filter (where s.\"totalLessons\" > 0 and s.\"completedLessons\" = s.\"totalLessons\")"
                    + "   as \"completed\" from (" + STUDENTS + ") s",
            nativeQuery = true)
    StudentSummary summarize(
            @Param("courseId") UUID courseId, @Param("versionId") UUID versionId, @Param("q") String q);

    @Query("select e.course.id as courseId, count(e) as students from CourseEnrollment e"
            + " where e.course.id in :courseIds and e.revokedAt is null group by e.course.id")
    List<CourseCount> countActive(@Param("courseIds") Collection<UUID> courseIds);

    interface StudentRow {
        String getFullName();

        String getAvatarUrl();

        Instant getEnrolledAt();

        Instant getLastAccessedAt();

        int getCompletedLessons();

        int getTotalLessons();
    }

    interface StudentSummary {
        long getTotal();

        long getNotStarted();

        long getCompleted();
    }

    interface CourseCount {
        UUID getCourseId();

        long getStudents();
    }

    @Override
    @EntityGraph(attributePaths = {"course", "course.publishedVersion", "course.publishedVersion.topic", "course.author"})
    Page<CourseEnrollment> findAll(Specification<CourseEnrollment> spec, Pageable pageable);
}
