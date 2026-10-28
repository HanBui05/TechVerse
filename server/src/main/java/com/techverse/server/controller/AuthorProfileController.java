package com.techverse.server.controller;

import com.techverse.server.dto.request.ApplyAuthorProfileRequest;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.AuthorProfileResponse;
import com.techverse.server.dto.response.MyAuthorProfileResponse;
import com.techverse.server.service.AuthorProfileService;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/author-profiles")
@RequiredArgsConstructor
@Tag(name = "Author Profiles", description = "Author application endpoints")
public class AuthorProfileController {

	private final AuthorProfileService authorProfileService;

	@GetMapping("/me")
	@PreAuthorize("isAuthenticated()")
	@Operation(summary = "Get the current user's author-profile application")
	public ResponseEntity<ApiResponse<MyAuthorProfileResponse>> getMyProfile(
			@AuthenticationPrincipal Jwt authenticatedUser
	) {
		MyAuthorProfileResponse authorProfile = authorProfileService.getMyProfile(
				UUID.fromString(authenticatedUser.getSubject())
		);
		return ResponseEntity.ok(ApiResponse.<MyAuthorProfileResponse>builder()
				.status(HttpStatus.OK.value())
				.message("Author profile retrieved successfully")
				.data(authorProfile)
				.build());
	}

	@PostMapping("/me")
	@PreAuthorize("isAuthenticated()")
	@Operation(summary = "Submit an author-profile application")
	public ResponseEntity<ApiResponse<AuthorProfileResponse>> apply(
			@AuthenticationPrincipal Jwt authenticatedUser,
			@Valid @RequestBody ApplyAuthorProfileRequest request
	) {
		AuthorProfileResponse authorProfile = authorProfileService.apply(
				UUID.fromString(authenticatedUser.getSubject()),
				request
		);
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(ApiResponse.<AuthorProfileResponse>builder()
						.status(HttpStatus.CREATED.value())
						.message("Author profile application submitted successfully")
						.data(authorProfile)
						.build());
	}
}
