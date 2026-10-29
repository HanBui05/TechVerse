package com.techverse.server.configuration;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.dto.internal.SocialProfile;
import com.techverse.server.enums.SocialProvider;
import com.techverse.server.exception.CustomException;
import com.techverse.server.properties.OAuth2Properties;
import com.techverse.server.service.AuthCookieService;
import com.techverse.server.service.AuthService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
@Slf4j
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

	private final AuthService authService;
	private final AuthCookieService authCookieService;
	private final OAuth2Properties oauth2Properties;

	@Override
	public void onAuthenticationSuccess(
			HttpServletRequest request,
			HttpServletResponse response,
			Authentication authentication
	) throws IOException, ServletException {
		String redirectUrl;
		try {
			OidcUser oidcUser = (OidcUser) authentication.getPrincipal();
			JwtDetails refreshToken = authService.authenticateSocialAccount(SocialProfile.builder()
					.provider(SocialProvider.GOOGLE)
					.providerId(oidcUser.getSubject())
					.email(oidcUser.getEmail())
					.fullName(oidcUser.getFullName())
					.pictureUrl(oidcUser.getClaimAsString("picture"))
					.emailVerified(Boolean.TRUE.equals(oidcUser.getClaimAsBoolean("email_verified")))
					.build());
			redirectUrl = callbackUrl("success", null);
			authCookieService.addRefreshTokenCookie(response, refreshToken);
		} catch (CustomException exception) {
			redirectUrl = callbackUrl("error", exception.getErrorCode().getCode());
		} catch (Exception exception) {
			log.error("Google OAuth2 callback could not complete", exception);
			redirectUrl = callbackUrl("error", "OAUTH2_AUTHENTICATION_FAILED");
		} finally {
			invalidateOAuthSession(request);
		}
		response.sendRedirect(redirectUrl);
	}

	private String callbackUrl(String status, String errorCode) {
		UriComponentsBuilder redirect = UriComponentsBuilder.fromUriString(oauth2Properties.webUrl())
				.path("/auth/callback")
				.queryParam("status", status);
		if (errorCode != null) {
			redirect.queryParam("code", errorCode);
		}
		return redirect.build().encode().toUriString();
	}

	private void invalidateOAuthSession(HttpServletRequest request) {
		if (request.getSession(false) != null) {
			request.getSession(false).invalidate();
		}
	}
}
