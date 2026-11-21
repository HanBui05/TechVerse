package com.techverse.server.controller;

import com.techverse.server.dto.request.ForumRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ForumResponse.*;
import com.techverse.server.service.impl.ForumService;

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
@RequestMapping("/api/v1/forum")
@RequiredArgsConstructor
@Tag(name = "Forum", description = "Questions and answers; guests read, signed-in accounts post")
public class ForumController {
    private final ForumService service;

    @GetMapping("/questions")
    @Operation(summary = "Visible questions, newest first; mine=true needs login")
    public ApiResponse<PageResponse<Summary>> list(@AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ForumRequest.Filter filter) {
        return ok("Forum questions retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/options")
    @Operation(summary = "Active topics")
    public ApiResponse<List<ArticleOptionResponse>> options() {
        return ok("Forum options retrieved", service.options());
    }

    @GetMapping("/questions/{id}")
    @Operation(summary = "A question with its visible answers, the accepted one first")
    public ApiResponse<Question> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Forum question retrieved", service.detail(actor(jwt), id));
    }

    @PostMapping("/questions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Ask a question; shown at once")
    public ApiResponse<Question> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ForumRequest.CreateQuestion request) {
        return ok("Forum question created", service.createQuestion(actor(jwt), request));
    }

    @PatchMapping("/questions/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Edit your question; omitted fields are kept")
    public ApiResponse<Question> update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ForumRequest.UpdateQuestion request) {
        return ok("Forum question updated", service.updateQuestion(actor(jwt), id, request));
    }

    @DeleteMapping("/questions/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Soft-delete your question")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.deleteQuestion(actor(jwt), id);
        return ok("Forum question deleted", null);
    }

    @PutMapping("/questions/{id}/accepted-answer")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Choose the accepted answer of your question; answerId null clears it")
    public ApiResponse<Question> accept(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ForumRequest.Accept request) {
        return ok("Accepted answer updated", service.accept(actor(jwt), id, request.getAnswerId() == null ? null : UUID.fromString(request.getAnswerId())));
    }

    @PostMapping("/questions/{id}/answers")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Answer a question")
    public ApiResponse<ForumResponse.Answer> answer(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ForumRequest.Answer request) {
        return ok("Forum answer created", service.createAnswer(actor(jwt), id, request));
    }

    @PatchMapping("/answers/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Edit your answer")
    public ApiResponse<ForumResponse.Answer> updateAnswer(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ForumRequest.Answer request) {
        return ok("Forum answer updated", service.updateAnswer(actor(jwt), id, request));
    }

    @DeleteMapping("/answers/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Soft-delete your answer")
    public ApiResponse<Void> deleteAnswer(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.deleteAnswer(actor(jwt), id);
        return ok("Forum answer deleted", null);
    }

    private static UUID actor(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
