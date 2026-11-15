package com.techverse.server.dto.response;

import com.techverse.server.entity.*;

import lombok.Builder;

import java.util.*;

/** One lesson of the working copy ({@code versionId} null) or of a snapshot; never a raw video URL. */
@Builder
public record LessonResponse(
        UUID id,
        UUID chapterId,
        UUID versionId,
        String title,
        String summary,
        String content,
        Video video,
        boolean preview,
        int position,
        boolean aiAssisted,
        String fingerprint,
        List<ArticleImageIssueResponse> imageIssues) {
    public record Video(String provider, String videoId) {}

    public static LessonResponse from(Lesson l, List<ArticleImageIssueResponse> imageIssues) {
        return LessonResponse.builder()
                .id(l.getId())
                .chapterId(l.getChapter().getId())
                .title(l.getTitle())
                .summary(l.getSummary())
                .content(l.getContent())
                .video(l.getVideoId() == null ? null : new Video(l.getVideoProvider(), l.getVideoId()))
                .preview(l.isPreview())
                .position(l.getPosition())
                .aiAssisted(l.isAiAssisted())
                .fingerprint(l.getContentFingerprint())
                .imageIssues(imageIssues)
                .build();
    }

    public static LessonResponse from(CourseVersionLesson vl, List<ArticleImageIssueResponse> imageIssues) {
        return LessonResponse.builder()
                .id(vl.getLesson().getId())
                .chapterId(vl.getVersionChapter().getChapter().getId())
                .versionId(vl.getVersion().getId())
                .title(vl.getTitle())
                .summary(vl.getSummary())
                .content(vl.getContent())
                .video(vl.getVideoId() == null ? null : new Video(vl.getVideoProvider(), vl.getVideoId()))
                .preview(vl.isPreview())
                .position(vl.getPosition())
                .aiAssisted(vl.isAiAssisted())
                .fingerprint(vl.getContentFingerprint())
                .imageIssues(imageIssues)
                .build();
    }
}
