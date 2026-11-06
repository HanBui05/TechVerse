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
}
