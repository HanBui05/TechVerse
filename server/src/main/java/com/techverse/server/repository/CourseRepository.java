package com.techverse.server.repository;

import com.techverse.server.entity.Course;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface CourseRepository extends JpaRepository<Course, UUID>, JpaSpecificationExecutor<Course> {
    /** Single lock for the whole course tree (chapters, lessons, tags, cleanup). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Course c where c.id=:id")
    Optional<Course> findByIdForUpdate(@Param("id") UUID id);
}
