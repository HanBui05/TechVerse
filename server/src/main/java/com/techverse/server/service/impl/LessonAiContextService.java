package com.techverse.server.service.impl;

import com.techverse.server.enums.ArticlePublicationStatus;
import com.techverse.server.exception.*;
import com.techverse.server.repository.CourseRepository;
import com.techverse.server.service.impl.AiPromptFactory.Ref;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import java.util.*;

/** AI for a lesson: the server, not the client, supplies taxonomy from the Author's own course. */
@Service
@RequiredArgsConstructor
public class LessonAiContextService {
    private final CourseRepository courses;

    public record Context(String courseTitle, Ref topic, List<Ref> tags) {}

    /** Call inside the caller's authorization transaction (lazy taxonomy). */
    public Context resolve(UUID actor, UUID courseId) {
        var course =
                courses.findById(courseId)
                        .filter(c -> c.getAuthor().getId().equals(actor)
                                && c.getPublicationStatus() != ArticlePublicationStatus.AUTHOR_DELETED)
                        .orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        var topic = course.getTopic();
        var tags = course.getCourseTags().stream().map(t -> t.getTag()).toList();
        if (!topic.isActive() || tags.stream().anyMatch(t -> !t.isActive()))
            throw new CustomException(ErrorCode.COURSE_TAXONOMY_INACTIVE);
        return new Context(
                course.getTitle(),
                new Ref(topic.getId(), topic.getName()),
                tags.stream().map(t -> new Ref(t.getId(), t.getName())).toList());
    }
}
