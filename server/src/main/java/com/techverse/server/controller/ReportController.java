package com.techverse.server.controller;

import com.techverse.server.dto.request.ReportRequest;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.ReportResponse;
import com.techverse.server.service.impl.ReportService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Reports", description = "Report a forum post; one report per user and post")
public class ReportController {
    private final ReportService service;

    @PostMapping
    @Operation(summary = "Report a forum post you can see and do not own; OTHER needs a description")
    public ApiResponse<ReportResponse.Created> create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ReportRequest.Create request) {
        var data = service.create(UUID.fromString(jwt.getSubject()), request);
        return ApiResponse.<ReportResponse.Created>builder().status(200).message("Report submitted").data(data).build();
    }
}
