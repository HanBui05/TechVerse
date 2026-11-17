package com.techverse.server.controller;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.impl.AuthorExerciseService;
import com.techverse.server.service.impl.ExerciseAiService;

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
@RequestMapping("/api/v1/author/exercise-sets")
@RequiredArgsConstructor
@Tag(name = "Author Exercises", description = "Own quiz and flashcard sets: metadata, questions, submission")
public class AuthorExerciseController {
    private final AuthorExerciseService service;
    private final ExerciseAiService ai;

    @GetMapping("/options")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Active topics")
    public ApiResponse<List<ArticleOptionResponse>> options(@AuthenticationPrincipal Jwt jwt) {
        return ok("Exercise options retrieved", service.options(actor(jwt)));
    }

    @PostMapping
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Create a DRAFT set; at most 10 creates/copies per minute")
    public ResponseEntity<ApiResponse<ExerciseSetResponse>> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ExerciseSetRequest.Create request) {
        return ResponseEntity.status(201).body(ApiResponse.<ExerciseSetResponse>builder()
                .status(201).message("Exercise set created").data(service.create(actor(jwt), request)).build());
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List own sets; suspended Authors retain read access")
    public ApiResponse<PageResponse<ExerciseSetResponse>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ExerciseSetRequest.Filter filter) {
        return ok("Exercise sets retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Own set with every question, answer and the current version")
    public ApiResponse<ExerciseSetResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Exercise set retrieved", service.detail(actor(jwt), id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Partial metadata update guarded by version")
    public ApiResponse<ExerciseSetResponse> update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ExerciseSetRequest.Update request) {
        return ok("Exercise set updated", service.update(actor(jwt), id, request));
    }

    @PutMapping("/{id}/questions")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Replace the whole question list in one transaction, guarded by version")
    public ApiResponse<ExerciseSetResponse> questions(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ExerciseSetRequest.Questions request) {
        return ok("Questions saved", service.replaceQuestions(actor(jwt), id, request));
    }

    @PostMapping("/{id}/ai/questions")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Propose questions with AI; saves nothing but the ai_assisted flag")
    public ResponseEntity<ApiResponse<ExerciseAiService.Suggestions>> aiQuestions(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ExerciseSetRequest.AiQuestions request) {
        var result = ai.suggest(actor(jwt), id, request);
        return ResponseEntity.ok()
                .header(AuthorAiController.QUOTA_LIMIT, String.valueOf(result.quota().limit()))
                .header(AuthorAiController.QUOTA_REMAINING, String.valueOf(result.quota().remaining()))
                .body(ApiResponse.<ExerciseAiService.Suggestions>builder()
                        .status(200).message("AI questions proposed").data(result.body()).build());
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Send for moderation")
    public ApiResponse<ExerciseSetResponse> submit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Exercise set submitted", service.submit(actor(jwt), id));
    }

    @PostMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Withdraw a pending set back to DRAFT")
    public ApiResponse<ExerciseSetResponse> withdraw(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Exercise set withdrawn", service.withdraw(actor(jwt), id));
    }

    @PatchMapping("/{id}/visibility")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Author HIDE/UNHIDE of a published set")
    public ApiResponse<ExerciseSetResponse> visibility(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ArticlePublicationRequest request) {
        return ok("Visibility updated", service.visibility(actor(jwt), id, request));
    }

    @PostMapping("/{id}/copy")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Copy into a new DRAFT")
    public ResponseEntity<ApiResponse<ExerciseSetResponse>> copy(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ResponseEntity.status(201).body(ApiResponse.<ExerciseSetResponse>builder()
                .status(201).message("Exercise set copied").data(service.copy(actor(jwt), id)).build());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Hard-delete a never-published, non-pending set; suspended Authors may delete")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(actor(jwt), id);
        return ok("Exercise set deleted", null);
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
