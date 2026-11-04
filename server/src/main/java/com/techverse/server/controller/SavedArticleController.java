package com.techverse.server.controller;

import com.techverse.server.dto.request.SavedArticleFilter;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.SavedArticleService;

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
@RequestMapping("/api/v1")
@RequiredArgsConstructor
// Manager accounts are separated from Reader features, even with extra LEARNER/AUTHOR roles.
@PreAuthorize("isAuthenticated() and !hasAnyRole('ADMIN', 'MODERATOR')")
@Tag(name = "Saved Articles", description = "Reader bookmarks of published articles")
public class SavedArticleController {
    private final SavedArticleService service;

    @PutMapping("/articles/{id}/saved")
    @Operation(summary = "Save a visible article (idempotent)")
    public ApiResponse<SavedArticleStateResponse> save(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Article saved", service.save(UUID.fromString(jwt.getSubject()), id));
    }

    @DeleteMapping("/articles/{id}/saved")
    @Operation(summary = "Remove a saved article (idempotent, any article state)")
    public ApiResponse<SavedArticleStateResponse> unsave(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Article unsaved", service.unsave(UUID.fromString(jwt.getSubject()), id));
    }

    @GetMapping("/me/saved-articles")
    @Operation(summary = "List my saved articles that are visible, newest save first")
    public ApiResponse<PageResponse<SavedArticleSummaryResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject @ModelAttribute SavedArticleFilter filter) {
        return ok("Saved articles retrieved", service.list(UUID.fromString(jwt.getSubject()), filter));
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
