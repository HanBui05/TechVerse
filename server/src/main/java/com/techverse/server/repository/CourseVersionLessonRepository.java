package com.techverse.server.repository;

import com.techverse.server.entity.CourseVersionLesson;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface CourseVersionLessonRepository extends JpaRepository<CourseVersionLesson, UUID> {
    /** Content of a lesson in every snapshot, for image cleanup reference checks. */
    @Query("select vl.content from CourseVersionLesson vl where vl.lesson.id = :lessonId")
    List<String> findContentsByLessonId(@Param("lessonId") UUID lessonId);

    /** Lessons of the given snapshots in reading order, Markdown excluded. */
    @Query(
            "select new com.techverse.server.dto.internal.CourseLessonRow(vl.version.id, vl.lesson.id,"
                    + " vc.id, vc.chapter.id, vl.title, vl.summary, vl.position, vl.preview,"
                    + " case when vl.videoId is not null then true else false end,"
                    + " case when vl.content is not null then true else false end,"
                    + " vl.aiAssisted, vl.contentFingerprint)"
                    + " from CourseVersionLesson vl join vl.versionChapter vc"
                    + " where vl.version.id in :versionIds order by vc.position, vl.position")
    List<com.techverse.server.dto.internal.CourseLessonRow> findRows(
            @Param("versionIds") Collection<UUID> versionIds);

    @EntityGraph(attributePaths = {"version", "versionChapter"})
    @Query(
            "select vl from CourseVersionLesson vl where vl.version.id = :versionId"
                    + " and vl.lesson.id = :lessonId")
    Optional<CourseVersionLesson> findInVersion(
            @Param("versionId") UUID versionId, @Param("lessonId") UUID lessonId);
}
