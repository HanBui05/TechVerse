package com.techverse.server.controller;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.InterviewQuestionResponse.Moderated;
import com.techverse.server.service.impl.ModeratorInterviewService;

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
@RequestMapping("/api/v1/moderator/interview-questions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MODERATOR')")
@Tag(name = "Moderator Interview Questions", description = "Review submitted interview questions and manage publication; drafts are private")
public class ModeratorInterviewController {
    private final ModeratorInterviewService service;

    @GetMapping
    @Operation(summary = "List non-draft questions; defaults to PENDING; filter by status, level, topic, keyword")
    public ApiResponse<PageResponse<Moderated>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute InterviewQuestionRequest.Filter filter) {
        return ok("Interview questions retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Full question with sample answer, hint and reviewToken")
    public ApiResponse<Moderated> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Interview question retrieved", service.detail(actor(jwt), id));
    }

    @PatchMapping("/{id}/review")
    @Operation(summary = "APPROVE or REQUEST_CHANGES (note required); stale token 409")
    public ApiResponse<Moderated> review(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody InterviewQuestionRequest.Review request) {
        return ok("Interview question reviewed", service.review(actor(jwt), id, request));
    }

    @PatchMapping("/{id}/publication")
    @Operation(summary = "HIDE/REMOVE require a reason; RESTORE returns to the state before HIDE")
    public ApiResponse<Moderated> publication(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody InterviewQuestionRequest.Publication request) {
        return ok("Interview publication updated", service.publication(actor(jwt), id, request));
    }

    private static UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
