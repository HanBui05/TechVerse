package com.techverse.server.controller;

import com.techverse.server.dto.request.UpdateMyProfileRequest;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.MyProfileResponse;
import com.techverse.server.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Authenticated user profile endpoints")
public class UserController {

	private final UserService userService;

	@GetMapping("/me")
	@PreAuthorize("isAuthenticated()")
	@Operation(summary = "Get the authenticated user's profile")
	public ResponseEntity<ApiResponse<MyProfileResponse>> getMyProfile(
			@AuthenticationPrincipal Jwt authenticatedUser
	) {
		MyProfileResponse profile = userService.getMyProfile(UUID.fromString(authenticatedUser.getSubject()));
		return ResponseEntity.ok(ApiResponse.<MyProfileResponse>builder()
				.status(HttpStatus.OK.value())
				.message("Profile retrieved successfully")
				.data(profile)
				.build());
	}

	@PatchMapping("/me")
	@PreAuthorize("isAuthenticated()")
	@Operation(summary = "Update the authenticated user's profile")
	public ResponseEntity<ApiResponse<MyProfileResponse>> updateMyProfile(
			@AuthenticationPrincipal Jwt authenticatedUser,
			@Valid @RequestBody UpdateMyProfileRequest request
	) {
		MyProfileResponse profile = userService.updateMyProfile(
				UUID.fromString(authenticatedUser.getSubject()),
				request
		);
		return ResponseEntity.ok(ApiResponse.<MyProfileResponse>builder()
				.status(HttpStatus.OK.value())
				.message("Profile updated successfully")
				.data(profile)
				.build());
	}
}
