package com.techverse.server.service.impl;

import com.techverse.server.entity.*;
import com.techverse.server.enums.ArticlePublicationStatus;
import com.techverse.server.exception.*;
import com.techverse.server.repository.CourseRepository;

import jakarta.persistence.EntityManager;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Lock order for every course write: users, profile ({@link ArticleAccessService}), then the
 * {@code courses} row, which also guards its chapters, lessons and tags; topic and tags last.
 */
@Service
@RequiredArgsConstructor
public class CourseAccessService {
    private final ArticleAccessService users;
    private final CourseRepository courses;
    private final EntityManager entityManager;

    public User lockWriter(UUID actor) {
        return users.lockWriter(actor);
    }

    public User lockActiveUser(UUID actor) {
        return users.lockActiveUser(actor);
    }

    public Course lockOwned(UUID actor, UUID id) {
        Course course =
                courses.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        // OSIV keeps entities across transactions; refresh cascades to chapters and lessons.
        entityManager.refresh(course);
        if (!isOwnedVisible(course, actor)) throw new CustomException(ErrorCode.COURSE_NOT_FOUND);
        return course;
    }

    public Course lockEditable(UUID actor, UUID id) {
        Course course = lockOwned(actor, id);
        course.ensureEditable();
        return course;
    }

    /** Read access (suspended Authors keep it); no lock. */
    public Course owned(UUID actor, UUID id) {
        users.checkReader(actor);
        return courses.findById(id)
                .filter(c -> isOwnedVisible(c, actor))
                .orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
    }

    public void checkReader(UUID actor) {
        users.checkReader(actor);
    }

    private static boolean isOwnedVisible(Course course, UUID actor) {
        return course.getAuthor().getId().equals(actor)
                && course.getPublicationStatus() != ArticlePublicationStatus.AUTHOR_DELETED;
    }
}
