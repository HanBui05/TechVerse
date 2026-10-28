package com.techverse.server.configuration;

import com.techverse.server.properties.OAuth2Properties;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
public class OAuth2LoginFailureHandler implements AuthenticationFailureHandler {

	private static final String OAUTH2_AUTHENTICATION_FAILED = "OAUTH2_AUTHENTICATION_FAILED";

	private final OAuth2Properties oauth2Properties;

	@Override
	public void onAuthenticationFailure(
			HttpServletRequest request,
			HttpServletResponse response,
			AuthenticationException exception
	) throws IOException, ServletException {
		invalidateOAuthSession(request);
		String redirectUrl = UriComponentsBuilder.fromUriString(oauth2Properties.webUrl())
				.path("/auth/callback")
				.queryParam("status", "error")
				.queryParam("code", OAUTH2_AUTHENTICATION_FAILED)
				.build()
				.encode()
				.toUriString();
		response.sendRedirect(redirectUrl);
	}

	private void invalidateOAuthSession(HttpServletRequest request) {
		if (request.getSession(false) != null) {
			request.getSession(false).invalidate();
		}
	}
}
