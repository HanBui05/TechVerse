package com.techverse.server.controller;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.InterviewQuestionResponse.*;
import com.techverse.server.service.impl.PublishedInterviewService;

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
@RequestMapping("/api/v1/interview-questions")
@RequiredArgsConstructor
@Tag(name = "Interview Practice", description = "Public interview questions; sample answers and marks need login")
public class PublishedInterviewController {
    private final PublishedInterviewService service;

    @GetMapping
    @Operation(summary = "Published questions, newest first (guests allowed); mark=SAVED|REVIEWED needs login")
    public ApiResponse<PageResponse<Published>> list(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute InterviewQuestionRequest.PublicFilter filter) {
        return ok("Interview questions retrieved", service.list(actor(jwt), filter));
    }

    @GetMapping("/options")
    @Operation(summary = "Active topics for the filter")
    public ApiResponse<List<ArticleOptionResponse>> options() {
        return ok("Interview options retrieved", service.options());
    }

    @GetMapping("/{id}")
    @Operation(summary = "One published question without hint or sample answer")
    public ApiResponse<Published> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Interview question retrieved", service.detail(actor(jwt), id));
    }

    @GetMapping("/{id}/answer")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Hint and sample answer")
    public ApiResponse<Answer> answer(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Answer retrieved", service.answer(actor(jwt), id));
    }

    @PutMapping("/{id}/mark")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Set reviewed/saved to the values sent; omitted fields are kept")
    public ApiResponse<Viewer> mark(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody InterviewQuestionRequest.Mark request) {
        return ok("Marks updated", service.mark(actor(jwt), id, request));
    }

    private static UUID actor(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
