package com.techverse.server.controller;

import com.techverse.server.dto.request.AdminAuthorApplicationFilter;
import com.techverse.server.dto.request.ReviewAuthorApplicationRequest;
import com.techverse.server.dto.request.SuspendAuthorRequest;
import com.techverse.server.dto.request.RestoreAuthorRequest;
import com.techverse.server.dto.response.AdminAuthorApplicationDetailResponse;
import com.techverse.server.dto.response.AdminAuthorApplicationSummaryResponse;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.service.AdminAuthorApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/author-applications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Author Applications", description = "Review author applications")
public class AdminAuthorApplicationController {
	private final AdminAuthorApplicationService service;

	@PatchMapping("/{id}/suspend")
	@Operation(summary = "Suspend an approved author without locking their learner account")
	public ResponseEntity<ApiResponse<AdminAuthorApplicationDetailResponse>> suspend(
			@AuthenticationPrincipal Jwt actor, @PathVariable UUID id,
			@Valid @RequestBody SuspendAuthorRequest request) {
		return ResponseEntity.ok(ApiResponse.<AdminAuthorApplicationDetailResponse>builder()
				.status(200).message("Author suspended successfully")
				.data(service.suspend(UUID.fromString(actor.getSubject()), id, request)).build());
	}

	@PatchMapping("/{id}/restore")
	@Operation(summary = "Restore a suspended author without unlocking their user account")
	public ResponseEntity<ApiResponse<AdminAuthorApplicationDetailResponse>> restore(
			@AuthenticationPrincipal Jwt actor, @PathVariable UUID id,
			@Valid @RequestBody RestoreAuthorRequest request) {
		return ResponseEntity.ok(ApiResponse.<AdminAuthorApplicationDetailResponse>builder()
				.status(200).message("Author restored successfully")
				.data(service.restore(UUID.fromString(actor.getSubject()), id, request)).build());
	}

	@GetMapping
	@Operation(summary = "List author applications with filters and pagination")
	public ResponseEntity<ApiResponse<PageResponse<AdminAuthorApplicationSummaryResponse>>> getApplications(
			@Valid @ParameterObject @ModelAttribute AdminAuthorApplicationFilter filter) {
		return ResponseEntity.ok(ApiResponse.<PageResponse<AdminAuthorApplicationSummaryResponse>>builder()
				.status(200).message("Author applications retrieved successfully").data(service.getApplications(filter)).build());
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get an author application and its review details")
	public ResponseEntity<ApiResponse<AdminAuthorApplicationDetailResponse>> getApplication(@PathVariable UUID id) {
		return ResponseEntity.ok(ApiResponse.<AdminAuthorApplicationDetailResponse>builder()
				.status(200).message("Author application retrieved successfully").data(service.getApplication(id)).build());
	}

	@PatchMapping("/{id}/review")
	@Operation(summary = "Approve or reject a pending application using its current version")
	public ResponseEntity<ApiResponse<AdminAuthorApplicationDetailResponse>> review(
			@AuthenticationPrincipal Jwt actor, @PathVariable UUID id,
			@Valid @RequestBody ReviewAuthorApplicationRequest request) {
		return ResponseEntity.ok(ApiResponse.<AdminAuthorApplicationDetailResponse>builder()
				.status(200).message("Author application reviewed successfully")
				.data(service.review(UUID.fromString(actor.getSubject()), id, request)).build());
	}
}
