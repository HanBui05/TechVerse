package com.techverse.server.controller;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.PublishedArticleService;

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
@RequestMapping("/api/v1/articles")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Published Articles", description = "Authenticated reading of published articles")
public class PublishedArticleController {
    private final PublishedArticleService service;

    /** List published articles using validated title/topic/tag filters and stable pagination. */
    @GetMapping
    @Operation(summary = "List published articles; search title and filter by topic/tag")
    public ApiResponse<PageResponse<PublishedArticleSummaryResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject @ModelAttribute PublishedArticleFilter filter) {
        return ok("Articles retrieved", service.list(UUID.fromString(jwt.getSubject()), filter));
    }

    /** Provide independently searched/paged topics and tags used by published articles. */
    @GetMapping("/options")
    @Operation(
            summary = "Get reader filter options, including inactive labels on published articles")
    public ApiResponse<PublishedArticleOptionsResponse> options(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject @ModelAttribute ArticleOptionsFilter filter) {
        return ok(
                "Article filter options retrieved",
                service.options(UUID.fromString(jwt.getSubject()), filter));
    }

    /** Read published Markdown and up to six related articles in one safe response. */
    @GetMapping("/{id}")
    @Operation(summary = "Read a published article with same-topic related articles")
    public ApiResponse<PublishedArticleDetailResponse> detail(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Article retrieved", service.detail(UUID.fromString(jwt.getSubject()), id));
    }

    /** Build the project's standard successful API envelope. */
    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
