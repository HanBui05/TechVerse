package com.techverse.server.repository;

import com.techverse.server.entity.CourseVersionLesson;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface CourseVersionLessonRepository extends JpaRepository<CourseVersionLesson, UUID> {
    /** Content of a lesson in every snapshot, for image cleanup reference checks. */
    @Query("select vl.content from CourseVersionLesson vl where vl.lesson.id = :lessonId")
    List<String> findContentsByLessonId(@Param("lessonId") UUID lessonId);

    @EntityGraph(attributePaths = {"version", "versionChapter"})
    @Query(
            "select vl from CourseVersionLesson vl where vl.version.id = :versionId"
                    + " and vl.lesson.id = :lessonId")
    Optional<CourseVersionLesson> findInVersion(
            @Param("versionId") UUID versionId, @Param("lessonId") UUID lessonId);
}
