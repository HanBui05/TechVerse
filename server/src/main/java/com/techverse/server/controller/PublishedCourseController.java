package com.techverse.server.controller;

import com.techverse.server.dto.request.ArticleFilter;
import com.techverse.server.dto.request.PublishedCourseFilter;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.PublishedCourseService;

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
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Published Courses", description = "Public free courses (guest preview), learning and progress")
public class PublishedCourseController {
    private final PublishedCourseService service;

    @GetMapping("/courses")
    @Operation(summary = "Public list of visible courses; search snapshot title, filter topic/tag/level, sort NEWEST/OLDEST")
    public ApiResponse<PageResponse<PublishedCourseSummaryResponse>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute PublishedCourseFilter filter) {
        return ok("Courses retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/courses/{id}")
    @Operation(summary = "Public snapshot detail with curriculum; enrolled learners also get progress and continueLesson")
    public ApiResponse<PublishedCourseDetailResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Course retrieved", service.detail(actor(jwt), id));
    }

    @GetMapping("/courses/{courseId}/lessons/{lessonId}")
    @Operation(summary = "Read a lesson: preview lessons for everyone, others for enrolled learners (updates continue learning)")
    public ApiResponse<PublishedLessonResponse> lesson(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID courseId, @PathVariable UUID lessonId) {
        return ok("Lesson retrieved", service.lesson(actor(jwt), courseId, lessonId));
    }

    @PostMapping("/courses/{id}/start")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Start a free course (idempotent); returns continueLesson and progress")
    public ApiResponse<CourseProgressResponse> start(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Course started", service.start(actor(jwt), id));
    }

    @PutMapping("/courses/{courseId}/lessons/{lessonId}/completion")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Mark a lesson of the current version completed (idempotent)")
    public ApiResponse<CourseProgressResponse> complete(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID courseId, @PathVariable UUID lessonId) {
        return ok("Lesson completed", service.completion(actor(jwt), courseId, lessonId, true));
    }

    @DeleteMapping("/courses/{courseId}/lessons/{lessonId}/completion")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Unmark a completed lesson (idempotent)")
    public ApiResponse<CourseProgressResponse> uncomplete(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID courseId, @PathVariable UUID lessonId) {
        return ok("Lesson completion removed", service.completion(actor(jwt), courseId, lessonId, false));
    }

    @GetMapping("/me/courses")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Started courses that are visible now, last accessed first, then newest start; only page/size apply")
    public ApiResponse<PageResponse<MyCourseResponse>> myCourses(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ArticleFilter filter) {
        return ok("Courses retrieved", service.myCourses(actor(jwt), filter.getPage(), filter.getSize()));
    }

    private static UUID actor(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
