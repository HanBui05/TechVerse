package com.techverse.server.service.impl;

import com.techverse.server.entity.Course;
import com.techverse.server.entity.Lesson;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.ArticleImageService.Target;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.util.*;

/** Managed images a course references, per document; used by SUBMIT (author) and APPROVE (moderator). */
@Service
@RequiredArgsConstructor
public class CourseImageReferences {
    private final LessonContentService content;
    private final ArticleImageService images;

    public record ImageRef(Target target, String url) {}

    /** Provider lookup; a missing or foreign asset means the course is no longer publishable. */
    public void checkLive(ImageRef ref) {
        try {
            images.validateManaged(ref.url(), ref.target());
        } catch (CustomException e) {
            if (e.getErrorCode() == ErrorCode.ARTICLE_IMAGE_INVALID)
                throw new CustomException(ErrorCode.COURSE_NOT_READY);
            throw CourseErrors.translate(e, true);
        }
    }

    /** Images of documents (course meta, lessons) that differ from the published version. */
    public List<ImageRef> changed(Course course, String description, String cover) {
        var refs = new ArrayList<ImageRef>();
        var owner = course.getAuthor().getId();
        var published = course.getPublishedVersion();
        if (published == null
                || !Objects.equals(published.getDescription(), description)
                || !Objects.equals(published.getCoverImageUrl(), cover))
            courseImages(refs, Target.course(owner, course.getId()), description, cover);
        var publishedLessons = new HashMap<UUID, String>();
        if (published != null)
            published.getLessons().forEach(vl -> publishedLessons.put(vl.getLesson().getId(), vl.getContentFingerprint()));
        for (Lesson lesson : course.activeLessons())
            if (!lesson.getContentFingerprint().equals(publishedLessons.get(lesson.getId())))
                lessonImages(refs, lesson);
        return refs;
    }

    public List<ImageRef> all(Course course) {
        var refs = new ArrayList<ImageRef>();
        courseImages(refs, Target.course(course.getAuthor().getId(), course.getId()), course.getDescription(), course.getCoverImageUrl());
        course.activeLessons().forEach(l -> lessonImages(refs, l));
        return refs;
    }

    private void courseImages(List<ImageRef> refs, Target target, String description, String cover) {
        content.imageUrls(description).forEach(url -> refs.add(new ImageRef(target, url)));
        if (cover != null) refs.add(new ImageRef(target, cover));
    }

    private void lessonImages(List<ImageRef> refs, Lesson lesson) {
        var target = Target.lesson(lesson.getCourse().getAuthor().getId(), lesson.getId(), lesson.getCourse().getId());
        content.imageUrls(lesson.getContent()).forEach(url -> refs.add(new ImageRef(target, url)));
    }
}
