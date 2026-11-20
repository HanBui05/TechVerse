package com.techverse.server.controller;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.impl.AuthorInterviewService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/author/interview-questions")
@RequiredArgsConstructor
@Tag(name = "Author Interview Questions", description = "Own interview questions: content, submission, visibility")
public class AuthorInterviewController {
    private final AuthorInterviewService service;

    @GetMapping("/options")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Active topics")
    public ApiResponse<List<ArticleOptionResponse>> options(@AuthenticationPrincipal Jwt jwt) {
        return ok("Interview options retrieved", service.options(actor(jwt)));
    }

    @PostMapping
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Create a DRAFT question; at most 20 creates/copies per minute")
    public ResponseEntity<ApiResponse<InterviewQuestionResponse>> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InterviewQuestionRequest.Create request) {
        return created("Interview question created", service.create(actor(jwt), request));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List own questions; suspended Authors retain read access")
    public ApiResponse<PageResponse<InterviewQuestionResponse>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute InterviewQuestionRequest.Filter filter) {
        return ok("Interview questions retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Own question with sample answer, hint and the current version")
    public ApiResponse<InterviewQuestionResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Interview question retrieved", service.detail(actor(jwt), id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Partial update guarded by version")
    public ApiResponse<InterviewQuestionResponse> update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody InterviewQuestionRequest.Update request) {
        return ok("Interview question updated", service.update(actor(jwt), id, request));
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Send for moderation")
    public ApiResponse<InterviewQuestionResponse> submit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Interview question submitted", service.submit(actor(jwt), id));
    }

    @PostMapping("/{id}/withdraw")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Withdraw a pending question back to DRAFT; suspended Authors may withdraw")
    public ApiResponse<InterviewQuestionResponse> withdraw(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Interview question withdrawn", service.withdraw(actor(jwt), id));
    }

    @PatchMapping("/{id}/visibility")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Author HIDE/UNHIDE of a published question; suspended Authors may only hide")
    public ApiResponse<InterviewQuestionResponse> visibility(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody InterviewQuestionRequest.Visibility request) {
        return ok("Visibility updated", service.visibility(actor(jwt), id, request));
    }

    @PostMapping("/{id}/copy")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Copy into a new DRAFT (the way to change a published question)")
    public ResponseEntity<ApiResponse<InterviewQuestionResponse>> copy(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return created("Interview question copied", service.copy(actor(jwt), id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Hard-delete a never-published, non-pending question; suspended Authors may delete")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(actor(jwt), id);
        return ok("Interview question deleted", null);
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
