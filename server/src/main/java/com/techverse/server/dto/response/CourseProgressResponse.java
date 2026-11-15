package com.techverse.server.dto.response;

import java.util.List;
import java.util.UUID;

/**
 * Learner state against the current snapshot: completed/total counts only include lessons of that
 * snapshot, {@code percent = floor(completed * 100 / total)}.
 */
public record CourseProgressResponse(
        UUID courseId,
        Progress progress,
        List<ChapterProgress> chapters,
        List<UUID> completedLessonIds,
        ContinueLesson continueLesson) {
    public record Progress(int completed, int total, int percent) {
        public static Progress of(int completed, int total) {
            return new Progress(completed, total, total == 0 ? 0 : completed * 100 / total);
        }
    }

    public record ChapterProgress(UUID chapterId, int completed, int total, int percent) {}

    public record ContinueLesson(UUID id, String title, UUID chapterId) {}
}
