package com.techverse.server.dto.response;

import com.techverse.server.entity.*;
import com.techverse.server.enums.*;

import lombok.Builder;

import java.time.Instant;
import java.util.*;

/** Author view: working metadata/tree plus the published tree; lesson content is not embedded. */
@Builder
public record CourseResponse(
        UUID id,
        UUID authorId,
        String title,
        String summary,
        String description,
        CourseLevel level,
        String coverImageUrl,
        ArticleOptionResponse topic,
        List<ArticleOptionResponse> tags,
        ArticleWorkflowStatus workflowStatus,
        ArticlePublicationStatus publicationStatus,
        String fingerprint,
        boolean hasUnpublishedChanges,
        List<Chapter> chapters,
        Version publishedVersion,
        List<ArticleImageIssueResponse> imageIssues,
        String moderationNote,
        Instant reviewedAt,
        Instant publishedAt,
        Instant createdAt,
        Instant updatedAt) {
    public record Chapter(UUID id, String title, int position, List<LessonItem> lessons) {}

    public record LessonItem(
            UUID id,
            String title,
            String summary,
            int position,
            boolean preview,
            boolean hasVideo,
            boolean hasContent,
            boolean aiAssisted) {}

    public record Version(
            UUID id, int versionNumber, Instant approvedAt, String fingerprint, List<Chapter> chapters) {}

    public static CourseResponse from(Course c, List<ArticleImageIssueResponse> imageIssues) {
        return CourseResponse.builder()
                .id(c.getId())
                .authorId(c.getAuthor().getId())
                .title(c.getTitle())
                .summary(c.getSummary())
                .description(c.getDescription())
                .level(c.getLevel())
                .coverImageUrl(c.getCoverImageUrl())
                .topic(option(c.getTopic()))
                .tags(c.getCourseTags().stream().map(t -> option(t.getTag())).toList())
                .workflowStatus(c.getWorkflowStatus())
                .publicationStatus(c.getPublicationStatus())
                .fingerprint(c.getContentFingerprint())
                .hasUnpublishedChanges(c.hasUnpublishedChanges())
                .chapters(
                        c.activeChapters().stream()
                                .map(ch -> new Chapter(
                                        ch.getId(),
                                        ch.getTitle(),
                                        ch.getPosition(),
                                        ch.activeLessons().stream()
                                                .map(l -> new LessonItem(
                                                        l.getId(),
                                                        l.getTitle(),
                                                        l.getSummary(),
                                                        l.getPosition(),
                                                        l.isPreview(),
                                                        l.getVideoId() != null,
                                                        l.getContent() != null,
                                                        l.isAiAssisted()))
                                                .toList()))
                                .toList())
                .publishedVersion(version(c.getPublishedVersion()))
                .imageIssues(imageIssues)
                .moderationNote(c.getModerationNote())
                .reviewedAt(c.getReviewedAt())
                .publishedAt(c.getPublishedAt())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build();
    }

    private static Version version(CoursePublicationVersion v) {
        if (v == null) return null;
        var lessons = new HashMap<UUID, List<LessonItem>>();
        v.getLessons().stream()
                .sorted(Comparator.comparingInt(CourseVersionLesson::getPosition))
                .forEach(vl -> lessons.computeIfAbsent(vl.getVersionChapter().getId(), k -> new ArrayList<>())
                        .add(new LessonItem(
                                vl.getLesson().getId(),
                                vl.getTitle(),
                                vl.getSummary(),
                                vl.getPosition(),
                                vl.isPreview(),
                                vl.getVideoId() != null,
                                vl.getContent() != null,
                                vl.isAiAssisted())));
        return new Version(
                v.getId(),
                v.getVersionNumber(),
                v.getApprovedAt(),
                v.getContentFingerprint(),
                v.getChapters().stream()
                        .map(vc -> new Chapter(
                                vc.getChapter().getId(),
                                vc.getTitle(),
                                vc.getPosition(),
                                lessons.getOrDefault(vc.getId(), List.of())))
                        .toList());
    }

    static ArticleOptionResponse option(Topic t) {
        return new ArticleOptionResponse(t.getId(), t.getName(), t.isActive());
    }

    static ArticleOptionResponse option(Tag t) {
        return new ArticleOptionResponse(t.getId(), t.getName(), t.isActive());
    }
}
