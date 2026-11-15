package com.techverse.server.service.impl;

import com.techverse.server.dto.response.*;
import com.techverse.server.exception.*;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.function.Predicate;

/**
 * Course description and lesson Markdown: the article validator unchanged, COURSE_* codes. Lesson
 * content is optional (null/blank = video-only); each document has its own 50-image cap.
 */
@Service
@RequiredArgsConstructor
public class LessonContentService {
    static final int MAX_IMAGES = 50;
    private final ArticleContentService content;

    public ArticleImportResponse importFile(MultipartFile file) {
        return CourseErrors.call(false, () -> content.importFile(file));
    }

    public void validateLesson(String text) {
        if (text == null || text.isBlank()) return;
        CourseErrors.run(false, () -> content.validateContent(text));
        if (content.imageUrls(text).size() > MAX_IMAGES) imageInvalid();
    }

    /** The cover counts toward the description's image cap. */
    public void validateDescription(String description, String coverImageUrl) {
        CourseErrors.run(false, () -> content.validateContent(description));
        if (content.imageUrls(description).size() + (coverImageUrl == null ? 0 : 1) > MAX_IMAGES)
            imageInvalid();
    }

    public List<String> imageUrls(String text) {
        return text == null ? List.of() : content.imageUrls(text);
    }

    public List<ArticleImageIssueResponse> imageIssues(String text, Predicate<String> managed) {
        return text == null ? List.of() : content.imageIssues(text, managed);
    }

    private static void imageInvalid() {
        throw new CustomException(ErrorCode.COURSE_IMAGE_INVALID);
    }
}
