package com.techverse.server.controller;

import com.techverse.server.dto.request.ExerciseSetRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.impl.ModeratorExerciseService;

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
@RequestMapping("/api/v1/moderator/exercise-sets")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MODERATOR')")
@Tag(name = "Moderator Exercises", description = "Review submitted exercise sets and manage publication; drafts are private")
public class ModeratorExerciseController {
    private final ModeratorExerciseService service;

    @GetMapping
    @Operation(summary = "List non-draft sets; defaults to PENDING; filter by status, type, topic, keyword")
    public ApiResponse<PageResponse<ExercisePracticeResponse.Moderated>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ExerciseSetRequest.ModeratorFilter filter) {
        return ok("Exercise sets retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Full set with questions, answers and reviewToken")
    public ApiResponse<ExercisePracticeResponse.Moderated> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Exercise set retrieved", service.detail(actor(jwt), id));
    }

    @PatchMapping("/{id}/review")
    @Operation(summary = "APPROVE or REQUEST_CHANGES (note required); stale token 409")
    public ApiResponse<ExercisePracticeResponse.Moderated> review(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ExerciseSetRequest.Review request) {
        return ok("Exercise set reviewed", service.review(actor(jwt), id, request));
    }

    @PatchMapping("/{id}/publication")
    @Operation(summary = "HIDE/REMOVE require a reason; RESTORE returns to the state before HIDE")
    public ApiResponse<ExercisePracticeResponse.Moderated> publication(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ExerciseSetRequest.Publication request) {
        return ok("Exercise publication updated", service.publication(actor(jwt), id, request));
    }

    private static UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
