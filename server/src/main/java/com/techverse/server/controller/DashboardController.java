package com.techverse.server.controller;

import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.DashboardResponse;
import com.techverse.server.service.impl.DashboardService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import lombok.RequiredArgsConstructor;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Overview counts for the Admin and Moderator pages")
public class DashboardController {
    private final DashboardService service;

    @GetMapping("/api/v1/admin/dashboard")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Users, authors, public content, orders to handle and revenue")
    public ApiResponse<DashboardResponse.Admin> admin(@AuthenticationPrincipal Jwt jwt) {
        return ok(service.admin(UUID.fromString(jwt.getSubject())));
    }

    @GetMapping("/api/v1/moderator/dashboard")
    @PreAuthorize("hasRole('MODERATOR')")
    @Operation(summary = "Pending review queues and open reports; never revenue")
    public ApiResponse<DashboardResponse.Moderator> moderator(@AuthenticationPrincipal Jwt jwt) {
        return ok(service.moderator(UUID.fromString(jwt.getSubject())));
    }

    private static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder().status(200).message("Dashboard retrieved").data(data).build();
    }
}
