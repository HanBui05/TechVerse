package com.techverse.server.controller;

import com.techverse.server.dto.request.AdminTagFilter;
import com.techverse.server.dto.request.CreateTagRequest;
import com.techverse.server.dto.request.UpdateTagRequest;
import com.techverse.server.dto.request.UpdateTagStatusRequest;
import com.techverse.server.dto.response.AdminTagResponse;
import com.techverse.server.dto.response.AdminTagSummaryResponse;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.service.AdminTagService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/tags")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Tags", description = "Manage shared tags without modifying linked content")
public class AdminTagController {
	private final AdminTagService service;

	@PostMapping
	@Operation(summary = "Create an active tag with a case-insensitive unique name")
	public ResponseEntity<ApiResponse<AdminTagResponse>> create(
			@AuthenticationPrincipal Jwt actor, @Valid @RequestBody CreateTagRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.<AdminTagResponse>builder()
				.status(201).message("Tag created successfully")
				.data(service.create(UUID.fromString(actor.getSubject()), request)).build());
	}

	@GetMapping
	@Operation(summary = "Search tags, including inactive tags, with pagination")
	public ResponseEntity<ApiResponse<PageResponse<AdminTagSummaryResponse>>> getTags(
			@Valid @ParameterObject @ModelAttribute AdminTagFilter filter) {
		return ResponseEntity.ok(ApiResponse.<PageResponse<AdminTagSummaryResponse>>builder()
				.status(200).message("Tags retrieved successfully").data(service.getTags(filter)).build());
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get tag details and audit information")
	public ResponseEntity<ApiResponse<AdminTagResponse>> getTag(@PathVariable UUID id) {
		return ResponseEntity.ok(ApiResponse.<AdminTagResponse>builder()
				.status(200).message("Tag retrieved successfully").data(service.getTag(id)).build());
	}

	@PatchMapping("/{id}")
	@Operation(summary = "Update provided name/description fields; description null clears it")
	public ResponseEntity<ApiResponse<AdminTagResponse>> update(
			@AuthenticationPrincipal Jwt actor, @PathVariable UUID id, @Valid @RequestBody UpdateTagRequest request) {
		return ResponseEntity.ok(ApiResponse.<AdminTagResponse>builder()
				.status(200).message("Tag updated successfully")
				.data(service.update(UUID.fromString(actor.getSubject()), id, request)).build());
	}

	@PatchMapping("/{id}/status")
	@Operation(summary = "Activate/deactivate a tag without changing linked content")
	public ResponseEntity<ApiResponse<AdminTagResponse>> updateStatus(
			@AuthenticationPrincipal Jwt actor, @PathVariable UUID id, @Valid @RequestBody UpdateTagStatusRequest request) {
		return ResponseEntity.ok(ApiResponse.<AdminTagResponse>builder()
				.status(200).message("Tag status updated successfully")
				.data(service.updateStatus(UUID.fromString(actor.getSubject()), id, request)).build());
	}
}
