package com.techverse.server.controller;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.ModeratorCourseService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/moderator/courses")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MODERATOR')")
@Tag(name = "Moderator Courses", description = "Review submitted courses and manage publication; drafts are private")
public class ModeratorCourseController {
    private final ModeratorCourseService service;

    @GetMapping
    @Operation(summary = "List non-draft courses; filter by status, topic, tag, author, created range")
    public ApiResponse<PageResponse<ModeratorCourseSummaryResponse>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ModeratorArticleFilter filter) {
        return ok("Courses retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Working/published trees, changeStatus per chapter/lesson and reviewToken; no lesson content")
    public ApiResponse<ModeratorCourseDetailResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Course retrieved", service.detail(actor(jwt), id));
    }

    @GetMapping("/{id}/lessons/{lessonId}")
    @Operation(summary = "Lesson content from the working copy, or from a snapshot when versionId is given")
    public ApiResponse<LessonResponse> lesson(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID lessonId,
            @RequestParam(required = false) UUID versionId) {
        return ok("Lesson retrieved", service.lesson(actor(jwt), id, lessonId, versionId));
    }

    @PatchMapping("/{id}/review")
    @Operation(summary = "APPROVE snapshots the whole course; REQUEST_CHANGES requires moderationNote; stale token 409")
    public ApiResponse<ModeratorCourseDetailResponse> review(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ReviewArticleRequest request) {
        return ok("Course reviewed successfully", service.review(actor(jwt), id, request));
    }

    @PatchMapping("/{id}/publication")
    @Operation(summary = "HIDE/REMOVE require moderationNote; RESTORE returns to the state before HIDE")
    public ApiResponse<ModeratorCourseDetailResponse> publication(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ArticlePublicationRequest request) {
        return ok("Course publication updated", service.publication(actor(jwt), id, request));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Full moderation/publication history, newest first; only page/size apply")
    public ApiResponse<PageResponse<CourseModerationHistoryResponse>> history(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @ParameterObject @ModelAttribute ArticleFilter filter) {
        return ok("Course history retrieved", service.history(actor(jwt), id, filter.getPage(), filter.getSize()));
    }

    private static UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
