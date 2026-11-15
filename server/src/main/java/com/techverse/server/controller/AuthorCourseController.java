package com.techverse.server.controller;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.AuthorArticleService;
import com.techverse.server.service.AuthorCourseService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/author/courses")
@RequiredArgsConstructor
@Tag(name = "Author Courses", description = "Own free courses: metadata, chapters, lessons, images, submission")
public class AuthorCourseController {
    private final AuthorCourseService service;
    private final AuthorArticleService articles;

    @GetMapping("/options")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Independently paged active Topics and Tags (same as articles)")
    public ApiResponse<ArticleOptionsResponse> options(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ArticleOptionsFilter f) {
        return ok("Course options retrieved", articles.options(actor(jwt), f));
    }

    @PostMapping("/import")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Import UTF-8 .md/.txt (1 MiB) for a description or lesson; saves nothing")
    public ApiResponse<ArticleImportResponse> importFile(
            @AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file) {
        return ok("Content imported", service.importFile(actor(jwt), file));
    }

    @PostMapping
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Create a course (no price: free); retry with the same UUID Idempotency-Key")
    public ResponseEntity<ApiResponse<CourseResponse>> create(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader("Idempotency-Key") UUID key,
            @Valid @RequestBody CourseWriteRequest request) {
        return created("Course created successfully", service.create(actor(jwt), key, request));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List own courses; suspended Authors retain read access")
    public ApiResponse<PageResponse<CourseSummaryResponse>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ArticleFilter f) {
        return ok("Courses retrieved", service.list(actor(jwt), f));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Working and published curriculum tree; lesson content is fetched per lesson")
    public ApiResponse<CourseResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Course retrieved", service.detail(actor(jwt), id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Partial metadata SAVE, or SUBMIT the whole tree for moderation")
    public ApiResponse<CourseResponse> update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody CourseWriteRequest request) {
        return ok("Course updated successfully", service.update(actor(jwt), id, request));
    }

    @PostMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Withdraw a pending revision back to DRAFT; published snapshot unchanged")
    public ApiResponse<CourseResponse> withdraw(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Course withdrawn", service.withdraw(actor(jwt), id));
    }

    @PostMapping("/{id}/discard")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Discard unsubmitted changes and restore the published metadata and curriculum")
    public ApiResponse<CourseResponse> discard(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Revision discarded", service.discard(actor(jwt), id));
    }

    @PatchMapping("/{id}/publication")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Author HIDE/UNHIDE of the published snapshot")
    public ApiResponse<CourseResponse> publication(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ArticlePublicationRequest request) {
        return ok("Publication updated", service.publication(actor(jwt), id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Hard-delete a never-approved course or soft-delete a published one; suspended Authors may delete")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(actor(jwt), id);
        return ok("Course deleted", null);
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Moderation/publication history, newest first; only page/size apply")
    public ApiResponse<PageResponse<CourseModerationHistoryResponse>> history(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @ParameterObject @ModelAttribute ArticleFilter f) {
        return ok("Course history retrieved", service.history(actor(jwt), id, f.getPage(), f.getSize()));
    }

    @PostMapping(value = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Upload a cover/description image (JPEG/PNG/WebP, 5 MiB); reuse UUID Upload-Key")
    public ApiResponse<ArticleImageResponse> uploadCourseImage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestHeader(value = "Upload-Key", required = false) UUID key,
            @RequestPart("file") MultipartFile file) {
        return ok("Image uploaded; save the course separately",
                service.uploadCourseImage(actor(jwt), id, key == null ? UUID.randomUUID() : key, file));
    }

    // ------------------------------------------------------------------ chapters

    @PostMapping("/{id}/chapters")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Append a chapter")
    public ResponseEntity<ApiResponse<CourseResponse>> addChapter(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody CourseChapterRequest request) {
        return created("Chapter created", service.addChapter(actor(jwt), id, request));
    }

    @PatchMapping("/{id}/chapters/{chapterId}")
    @PreAuthorize("hasRole('AUTHOR')")
    public ApiResponse<CourseResponse> editChapter(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID chapterId,
            @Valid @RequestBody CourseChapterRequest request) {
        return ok("Chapter updated", service.editChapter(actor(jwt), id, chapterId, request));
    }

    @DeleteMapping("/{id}/chapters/{chapterId}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Delete a never-published chapter or archive a published one with its lessons")
    public ApiResponse<CourseResponse> deleteChapter(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID chapterId) {
        return ok("Chapter deleted", service.deleteChapter(actor(jwt), id, chapterId));
    }

    @PutMapping("/{id}/chapters:reorder")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Reorder chapters: every active chapter ID exactly once")
    public ApiResponse<CourseResponse> reorderChapters(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody CourseReorderRequest request) {
        return ok("Chapters reordered", service.reorderChapters(actor(jwt), id, request));
    }

    // ------------------------------------------------------------------ lessons

    @PostMapping("/{id}/chapters/{chapterId}/lessons")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Append a lesson (YouTube video and/or Markdown); retry with the same UUID Idempotency-Key")
    public ResponseEntity<ApiResponse<LessonResponse>> createLesson(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID chapterId,
            @RequestHeader("Idempotency-Key") UUID key,
            @Valid @RequestBody LessonWriteRequest request) {
        return created("Lesson created", service.createLesson(actor(jwt), id, chapterId, key, request));
    }

    @PutMapping("/{id}/chapters/{chapterId}/lessons:reorder")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Reorder lessons of a chapter: every active lesson ID exactly once")
    public ApiResponse<CourseResponse> reorderLessons(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID chapterId,
            @Valid @RequestBody CourseReorderRequest request) {
        return ok("Lessons reordered", service.reorderLessons(actor(jwt), id, chapterId, request));
    }

    @GetMapping("/{id}/lessons/{lessonId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lesson of the working copy, or of a snapshot of this course with versionId")
    public ApiResponse<LessonResponse> lesson(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID lessonId,
            @RequestParam(required = false) UUID versionId) {
        return ok("Lesson retrieved", service.lesson(actor(jwt), id, lessonId, versionId));
    }

    @PatchMapping("/{id}/lessons/{lessonId}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Partial lesson update; summary/content/videoUrl may be null to clear")
    public ApiResponse<LessonResponse> updateLesson(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID lessonId,
            @Valid @RequestBody LessonWriteRequest request) {
        return ok("Lesson updated", service.updateLesson(actor(jwt), id, lessonId, request));
    }

    @DeleteMapping("/{id}/lessons/{lessonId}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Delete a never-published lesson or archive a published one (ID and progress kept)")
    public ApiResponse<CourseResponse> deleteLesson(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID lessonId) {
        return ok("Lesson deleted", service.deleteLesson(actor(jwt), id, lessonId));
    }

    @PostMapping(value = "/{id}/lessons/{lessonId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Upload an image for this lesson's Markdown (JPEG/PNG/WebP, 5 MiB); reuse UUID Upload-Key")
    public ApiResponse<ArticleImageResponse> uploadLessonImage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID lessonId,
            @RequestHeader(value = "Upload-Key", required = false) UUID key,
            @RequestPart("file") MultipartFile file) {
        return ok("Image uploaded; save the lesson separately",
                service.uploadLessonImage(actor(jwt), id, lessonId, key == null ? UUID.randomUUID() : key, file));
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }

    private <T> ResponseEntity<ApiResponse<T>> created(String message, T data) {
        return ResponseEntity.status(201).body(ApiResponse.<T>builder().status(201).message(message).data(data).build());
    }
}
