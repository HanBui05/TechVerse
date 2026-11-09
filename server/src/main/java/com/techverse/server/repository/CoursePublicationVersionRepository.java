package com.techverse.server.repository;

import com.techverse.server.entity.CoursePublicationVersion;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface CoursePublicationVersionRepository
        extends JpaRepository<CoursePublicationVersion, UUID> {
    /** Description and cover of every snapshot of a course, for image cleanup reference checks. */
    @Query(
            "select v.description, v.coverImageUrl from CoursePublicationVersion v"
                    + " where v.course.id = :courseId")
    List<Object[]> findImageSources(@Param("courseId") UUID courseId);

    /** {@code [versionId, tagId, tagName]} of the given snapshots, one query per page. */
    @Query(
            "select vt.version.id, t.id, t.name from CourseVersionTag vt join vt.tag t"
                    + " where vt.version.id in :versionIds order by t.name, t.id")
    List<Object[]> findTagRows(@Param("versionIds") Collection<UUID> versionIds);
}
