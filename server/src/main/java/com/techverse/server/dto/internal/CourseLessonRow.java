package com.techverse.server.dto.internal;

import java.util.UUID;

/** Snapshot lesson without its Markdown, for curriculum trees, progress and diffs. */
public record CourseLessonRow(
        UUID versionId,
        UUID lessonId,
        UUID versionChapterId,
        UUID chapterId,
        String title,
        String summary,
        int position,
        boolean preview,
        boolean hasVideo,
        boolean hasContent,
        boolean aiAssisted,
        String contentFingerprint) {}
