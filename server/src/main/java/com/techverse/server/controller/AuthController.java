package com.techverse.server.controller;

import com.techverse.server.dto.internal.LoginTokens;
import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.dto.request.LoginRequest;
import com.techverse.server.dto.request.RegisterRequest;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.LoginResponse;
import com.techverse.server.dto.response.RegisterResponse;
import com.techverse.server.properties.JwtProperties;
import com.techverse.server.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Account registration and authentication endpoints")
public class AuthController {

	private final AuthService authService;
	private final JwtProperties jwtProperties;

	@PostMapping("/register")
	@Operation(summary = "Register a learner account")
	public ResponseEntity<ApiResponse<RegisterResponse>> register(@Valid @RequestBody RegisterRequest request) {
		RegisterResponse response = authService.register(request);
		return ResponseEntity.status(HttpStatus.CREATED)
				.body(ApiResponse.<RegisterResponse>builder()
						.status(HttpStatus.CREATED.value())
						.message("User registered successfully")
						.data(response)
						.build());
	}

	@PostMapping("/login")
	@Operation(summary = "Authenticate with email and password")
	public ResponseEntity<ApiResponse<LoginResponse>> login(
			@Valid @RequestBody LoginRequest request,
			HttpServletResponse response
	) {
		LoginTokens tokens = authService.login(request);
		return tokenResponse(tokens, response, "User authenticated successfully");
	}

	@PostMapping("/refresh")
	@Operation(summary = "Rotate access and refresh tokens")
	public ResponseEntity<ApiResponse<LoginResponse>> refresh(
			@CookieValue(value = "refresh_token", required = false) String refreshToken,
			HttpServletResponse response
	) {
		LoginTokens tokens = authService.refresh(refreshToken);
		return tokenResponse(tokens, response, "Token refreshed successfully");
	}

	@PostMapping("/logout")
	@Operation(summary = "Log out from the current device")
	public ResponseEntity<ApiResponse<Void>> logout(
			@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
			@CookieValue(value = "refresh_token", required = false) String refreshToken,
			HttpServletResponse response
	) {
		authService.logout(extractBearerToken(authorization), refreshToken);
		clearRefreshTokenCookie(response);
		return ResponseEntity.ok(ApiResponse.<Void>builder()
				.status(HttpStatus.OK.value())
				.message("User logged out successfully")
				.build());
	}

	@PostMapping("/logout-all")
	@Operation(summary = "Log out from every device")
	public ResponseEntity<ApiResponse<Void>> logoutAll(
			@AuthenticationPrincipal Jwt authenticatedUser,
			HttpServletResponse response
	) {
		authService.logoutAll(UUID.fromString(authenticatedUser.getSubject()));
		clearRefreshTokenCookie(response);
		return ResponseEntity.ok(ApiResponse.<Void>builder()
				.status(HttpStatus.OK.value())
				.message("User logged out from all devices successfully")
				.build());
	}

	private ResponseEntity<ApiResponse<LoginResponse>> tokenResponse(
			LoginTokens tokens,
			HttpServletResponse response,
			String message
	) {
		addRefreshTokenCookie(response, tokens.getRefreshToken());
		LoginResponse loginResponse = LoginResponse.builder()
				.accessToken(tokens.getAccessToken().getValue())
				.expiresAt(tokens.getAccessToken().getExpiresAt())
				.expiresIn(tokens.getAccessToken().getSecondsTtl())
				.build();
		return ResponseEntity.ok(ApiResponse.<LoginResponse>builder()
				.status(HttpStatus.OK.value())
				.message(message)
				.data(loginResponse)
				.build());
	}

	private void addRefreshTokenCookie(HttpServletResponse response, JwtDetails refreshToken) {
		Duration maxAge = Duration.between(Instant.now(), refreshToken.getExpiresAt());
		ResponseCookie cookie = ResponseCookie.from("refresh_token", refreshToken.getValue())
				.httpOnly(true)
				.secure(jwtProperties.refreshCookieSecure())
				.sameSite("Lax")
				.path("/api/v1/auth")
				.maxAge(maxAge)
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	private void clearRefreshTokenCookie(HttpServletResponse response) {
		ResponseCookie cookie = ResponseCookie.from("refresh_token", "")
				.httpOnly(true)
				.secure(jwtProperties.refreshCookieSecure())
				.sameSite("Lax")
				.path("/api/v1/auth")
				.maxAge(Duration.ZERO)
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	private String extractBearerToken(String authorization) {
		if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
			return null;
		}
		return authorization.substring(7).trim();
	}
}
