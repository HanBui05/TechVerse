package com.techverse.server.controller;

import com.techverse.server.dto.request.ExerciseSetRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.impl.PublishedExerciseService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Practice", description = "Public exercise sets, taking them, and own attempt history")
public class PublishedExerciseController {
    private final PublishedExerciseService service;

    @GetMapping("/exercise-sets")
    @Operation(summary = "Public list of published sets (guests allowed); signed-in users also get their last attempt")
    public ApiResponse<PageResponse<ExercisePracticeResponse.PracticeSet>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ExerciseSetRequest.PublicFilter filter) {
        return ok("Exercise sets retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/exercise-sets/options")
    @Operation(summary = "Active topics for the filter")
    public ApiResponse<List<ArticleOptionResponse>> options() {
        return ok("Exercise options retrieved", service.options());
    }

    @GetMapping("/exercise-sets/{id}")
    @Operation(summary = "Introduction page: no questions; viewer.canAttempt says whether the caller may take the set")
    public ApiResponse<ExercisePracticeResponse.PracticeSet> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Exercise set retrieved", service.detail(actor(jwt), id));
    }

    @GetMapping("/exercise-sets/{id}/questions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Questions to answer: quiz without answers or explanations, flashcards with both faces")
    public ApiResponse<ExercisePracticeResponse.Questions> questions(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Questions retrieved", service.questions(actor(jwt), id));
    }

    @PostMapping("/exercise-sets/{id}/attempts")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Submit an attempt; the Idempotency-Key header (UUID) makes retries return the stored result")
    public ApiResponse<ExercisePracticeResponse.Attempt> submit(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestHeader(value = "Idempotency-Key", required = false) String key,
            @RequestBody ExerciseSetRequest.Attempt request) {
        return ok("Attempt submitted", service.submit(actor(jwt), id, key, request));
    }

    @GetMapping("/me/exercise-attempts")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Own attempts, newest first; optional exerciseSetId")
    public ApiResponse<PageResponse<ExercisePracticeResponse.Attempt>> history(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ExerciseSetRequest.AttemptFilter filter) {
        return ok("Attempts retrieved", service.history(actor(jwt), filter));
    }

    @GetMapping("/me/exercise-attempts/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "One own attempt from its stored snapshot, even if the set was hidden or removed")
    public ApiResponse<ExercisePracticeResponse.Attempt> attempt(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Attempt retrieved", service.attempt(actor(jwt), id));
    }

    private static UUID actor(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
