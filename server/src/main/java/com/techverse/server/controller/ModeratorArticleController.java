package com.techverse.server.controller;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.ModeratorArticleService;

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
@RequestMapping("/api/v1/moderator/articles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MODERATOR')")
@Tag(name = "Moderator Articles", description = "Review submitted articles; drafts are private")
public class ModeratorArticleController {
    private final ModeratorArticleService service;

    @GetMapping
    @Operation(summary = "List all non-draft articles; optionally filter by status")
    public ApiResponse<PageResponse<ModeratorArticleSummaryResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject @ModelAttribute ModeratorArticleFilter filter) {
        return ok("Articles retrieved", service.list(UUID.fromString(jwt.getSubject()), filter));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Read article and obtain reviewToken for the current submission")
    public ApiResponse<ModeratorArticleDetailResponse> detail(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Article retrieved", service.detail(UUID.fromString(jwt.getSubject()), id));
    }

    @PatchMapping("/{id}/review")
    @Operation(
            summary =
                    "APPROVE publishes; REQUEST_CHANGES requires moderationNote; stale reviews"
                        + " return 409")
    public ApiResponse<ModeratorArticleDetailResponse> review(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ReviewArticleRequest request) {
        return ok(
                "Article reviewed successfully",
                service.review(UUID.fromString(jwt.getSubject()), id, request));
    }

    @PatchMapping("/{id}/publication")
    @Operation(
            summary =
                    "HIDE/REMOVE require moderationNote; RESTORE returns to the state before HIDE;"
                            + " stale reviewToken returns 409")
    public ApiResponse<ModeratorArticleDetailResponse> publication(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ArticlePublicationRequest request) {
        return ok(
                "Article publication updated",
                service.publication(UUID.fromString(jwt.getSubject()), id, request));
    }

    @GetMapping("/{id}/history")
    @Operation(summary = "Full moderation/publication history, newest first; only page/size apply")
    public ApiResponse<PageResponse<ArticleModerationHistoryResponse>> history(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @ParameterObject @ModelAttribute ArticleFilter filter) {
        return ok(
                "Article history retrieved",
                service.history(
                        UUID.fromString(jwt.getSubject()), id, filter.getPage(), filter.getSize()));
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
