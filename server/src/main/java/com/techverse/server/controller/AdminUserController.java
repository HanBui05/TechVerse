package com.techverse.server.controller;

import com.techverse.server.dto.request.AdminUserFilter;
import com.techverse.server.dto.response.AdminUserDetailResponse;
import com.techverse.server.dto.response.AdminUserSummaryResponse;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@Tag(name = "Admin Users", description = "Admin user management endpoints")
public class AdminUserController {

	private final AdminUserService adminUserService;

	@GetMapping
	@PreAuthorize("hasRole('ADMIN')")
	@Operation(summary = "List users with pagination and filters")
	public ResponseEntity<ApiResponse<PageResponse<AdminUserSummaryResponse>>> getUsers(
			@Valid @ParameterObject @ModelAttribute AdminUserFilter filter
	) {
		PageResponse<AdminUserSummaryResponse> users = adminUserService.getUsers(filter);
		return ResponseEntity.ok(ApiResponse.<PageResponse<AdminUserSummaryResponse>>builder()
				.status(HttpStatus.OK.value())
				.message("Users retrieved successfully")
				.data(users)
				.build());
	}

	@GetMapping("/{userId}")
	@PreAuthorize("hasRole('ADMIN')")
	@Operation(summary = "Get user details by ID")
	public ResponseEntity<ApiResponse<AdminUserDetailResponse>> getUserDetails(
			@PathVariable UUID userId
	) {
		AdminUserDetailResponse user = adminUserService.getUserDetails(userId);
		return ResponseEntity.ok(ApiResponse.<AdminUserDetailResponse>builder()
				.status(HttpStatus.OK.value())
				.message("User details retrieved successfully")
				.data(user)
				.build());
	}
}
