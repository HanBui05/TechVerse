package com.techverse.server.controller;

import com.techverse.server.dto.request.ReportRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ReportResponse.*;
import com.techverse.server.service.impl.ReportService;

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
@RequestMapping("/api/v1/moderator")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MODERATOR')")
@Tag(name = "Moderator Reports", description = "Report queue and direct hide/restore of forum posts")
public class ModeratorReportController {
    private final ReportService service;

    @GetMapping("/reports")
    @Operation(summary = "Report queue; status defaults to OPEN (oldest first), closed ones newest first")
    public ApiResponse<PageResponse<Item>> queue(@AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ReportRequest.Queue filter) {
        return ok("Reports retrieved", service.queue(actor(jwt), filter));
    }

    @PatchMapping("/reports/{id}/resolve")
    @Operation(summary = "HIDE_CONTENT (note required) or DISMISS; applies to every open report of the same post")
    public ApiResponse<Item> resolve(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ReportRequest.Resolve request) {
        return ok("Report resolved", service.resolve(actor(jwt), id, request));
    }

    @GetMapping("/forum/posts")
    @Operation(summary = "Hidden forum posts, most recently hidden first")
    public ApiResponse<PageResponse<ModeratedPost>> hidden(@AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ReportRequest.Hidden filter) {
        return ok("Hidden forum posts retrieved", service.hidden(actor(jwt), filter));
    }

    @PatchMapping("/forum/posts/{id}/visibility")
    @Operation(summary = "HIDE a visible post (note required, closes its open reports) or RESTORE a hidden one")
    public ApiResponse<ModeratedPost> visibility(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ReportRequest.Visibility request) {
        return ok("Forum post visibility updated", service.visibility(actor(jwt), id, request));
    }

    private static UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
