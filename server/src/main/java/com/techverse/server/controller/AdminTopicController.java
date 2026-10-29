package com.techverse.server.controller;

import com.techverse.server.dto.request.AdminTopicFilter;
import com.techverse.server.dto.request.CreateTopicRequest;
import com.techverse.server.dto.request.UpdateTopicRequest;
import com.techverse.server.dto.request.UpdateTopicStatusRequest;
import com.techverse.server.dto.response.AdminTopicResponse;
import com.techverse.server.dto.response.AdminTopicSummaryResponse;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.service.AdminTopicService;
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
@RequestMapping("/api/v1/admin/topics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Topics", description = "Manage shared topics without modifying linked content")
public class AdminTopicController {
	private final AdminTopicService service;

	@PostMapping
	@Operation(summary = "Create an active topic with a case-insensitive unique name")
	public ResponseEntity<ApiResponse<AdminTopicResponse>> create(
			@AuthenticationPrincipal Jwt actor, @Valid @RequestBody CreateTopicRequest request) {
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.<AdminTopicResponse>builder()
				.status(201).message("Topic created successfully")
				.data(service.create(UUID.fromString(actor.getSubject()), request)).build());
	}

	@GetMapping
	@Operation(summary = "Search topics, including inactive topics, with pagination")
	public ResponseEntity<ApiResponse<PageResponse<AdminTopicSummaryResponse>>> getTopics(
			@Valid @ParameterObject @ModelAttribute AdminTopicFilter filter) {
		return ResponseEntity.ok(ApiResponse.<PageResponse<AdminTopicSummaryResponse>>builder()
				.status(200).message("Topics retrieved successfully").data(service.getTopics(filter)).build());
	}

	@GetMapping("/{id}")
	@Operation(summary = "Get topic details and audit information")
	public ResponseEntity<ApiResponse<AdminTopicResponse>> getTopic(@PathVariable UUID id) {
		return ResponseEntity.ok(ApiResponse.<AdminTopicResponse>builder()
				.status(200).message("Topic retrieved successfully").data(service.getTopic(id)).build());
	}

	@PatchMapping("/{id}")
	@Operation(summary = "Update provided name/description fields; description null clears it")
	public ResponseEntity<ApiResponse<AdminTopicResponse>> update(
			@AuthenticationPrincipal Jwt actor, @PathVariable UUID id, @Valid @RequestBody UpdateTopicRequest request) {
		return ResponseEntity.ok(ApiResponse.<AdminTopicResponse>builder()
				.status(200).message("Topic updated successfully")
				.data(service.update(UUID.fromString(actor.getSubject()), id, request)).build());
	}

	@PatchMapping("/{id}/status")
	@Operation(summary = "Activate/deactivate a topic without changing linked content")
	public ResponseEntity<ApiResponse<AdminTopicResponse>> updateStatus(
			@AuthenticationPrincipal Jwt actor, @PathVariable UUID id, @Valid @RequestBody UpdateTopicStatusRequest request) {
		return ResponseEntity.ok(ApiResponse.<AdminTopicResponse>builder()
				.status(200).message("Topic status updated successfully")
				.data(service.updateStatus(UUID.fromString(actor.getSubject()), id, request)).build());
	}
}
