package com.techverse.server.service.impl;

import com.techverse.server.exception.*;

import java.util.function.Supplier;

/** Maps errors of the shared article content/image services to the course contract. */
public final class CourseErrors {
    private CourseErrors() {}

    /** {@code image}: the decoder's size/type errors become image codes, not file codes. */
    public static CustomException translate(CustomException e, boolean image) {
        ErrorCode code =
                switch (e.getErrorCode()) {
                    case ARTICLE_CONTENT_INVALID -> ErrorCode.COURSE_CONTENT_INVALID;
                    case ARTICLE_FILE_TOO_LARGE ->
                            image ? ErrorCode.COURSE_IMAGE_TOO_LARGE : ErrorCode.COURSE_FILE_TOO_LARGE;
                    case ARTICLE_FILE_UNSUPPORTED ->
                            image ? ErrorCode.COURSE_IMAGE_UNSUPPORTED : ErrorCode.COURSE_FILE_UNSUPPORTED;
                    case ARTICLE_FILE_INVALID -> ErrorCode.COURSE_FILE_INVALID;
                    case ARTICLE_IMAGE_INVALID -> ErrorCode.COURSE_IMAGE_INVALID;
                    case ARTICLE_IMAGE_UPLOAD_FAILED -> ErrorCode.COURSE_IMAGE_UPLOAD_FAILED;
                    case ARTICLE_RATE_LIMITED -> ErrorCode.COURSE_RATE_LIMITED;
                    case ARTICLE_STORAGE_UNAVAILABLE -> ErrorCode.COURSE_STORAGE_UNAVAILABLE;
                    case ARTICLE_KEY_CONFLICT -> ErrorCode.COURSE_KEY_CONFLICT;
                    case ARTICLE_REQUEST_IN_PROGRESS -> ErrorCode.COURSE_REQUEST_IN_PROGRESS;
                    case ARTICLE_ASSOCIATION_INACTIVE -> ErrorCode.COURSE_TAXONOMY_INACTIVE;
                    case ARTICLE_NOT_FOUND -> ErrorCode.COURSE_NOT_FOUND;
                    case ARTICLE_NOT_EDITABLE -> ErrorCode.COURSE_NOT_EDITABLE;
                    default -> e.getErrorCode();
                };
        return code == e.getErrorCode() ? e : new CustomException(code);
    }

    public static <T> T call(boolean image, Supplier<T> action) {
        try {
            return action.get();
        } catch (CustomException e) {
            throw translate(e, image);
        }
    }

    public static void run(boolean image, Runnable action) {
        call(image, () -> {
            action.run();
            return null;
        });
    }
}
