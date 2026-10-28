package com.techverse.server.service;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.properties.JwtProperties;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthCookieService {

	private static final String REFRESH_TOKEN_COOKIE = "refresh_token";
	private static final String REFRESH_COOKIE_PATH = "/api/v1/auth";

	private final JwtProperties jwtProperties;

	public void addRefreshTokenCookie(HttpServletResponse response, JwtDetails refreshToken) {
		ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_COOKIE, refreshToken.getValue())
				.httpOnly(true)
				.secure(jwtProperties.refreshCookieSecure())
				.sameSite("Lax")
				.path(REFRESH_COOKIE_PATH)
				.maxAge(Duration.ofSeconds(refreshToken.getSecondsTtl()))
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	public void clearRefreshTokenCookie(HttpServletResponse response) {
		ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
				.httpOnly(true)
				.secure(jwtProperties.refreshCookieSecure())
				.sameSite("Lax")
				.path(REFRESH_COOKIE_PATH)
				.maxAge(Duration.ZERO)
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}
}
