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
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseCookie;

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
		addRefreshTokenCookie(response, tokens.getRefreshToken());

		LoginResponse loginResponse = LoginResponse.builder()
				.accessToken(tokens.getAccessToken().getValue())
				.expiresAt(tokens.getAccessToken().getExpiresAt())
				.expiresIn(tokens.getAccessToken().getSecondsTtl())
				.build();

		return ResponseEntity.ok(ApiResponse.<LoginResponse>builder()
				.status(HttpStatus.OK.value())
				.message("User authenticated successfully")
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
}
