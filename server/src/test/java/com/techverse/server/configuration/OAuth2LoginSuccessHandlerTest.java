package com.techverse.server.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.techverse.server.dto.internal.SocialProfile;
import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.properties.OAuth2Properties;
import com.techverse.server.service.AuthCookieService;
import com.techverse.server.service.AuthService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;

class OAuth2LoginSuccessHandlerTest {

	@Test
	void passesVerifiedGooglePictureToAccountCreation() throws Exception {
		AuthService service = mock(AuthService.class);
		when(service.authenticateSocialAccount(any(SocialProfile.class))).thenAnswer(call -> {
			SocialProfile profile = call.getArgument(0);
			assertThat(profile.getPictureUrl()).isEqualTo("https://lh3.googleusercontent.com/a/photo");
			return JwtDetails.builder().value("refresh").build();
		});
		var handler = new OAuth2LoginSuccessHandler(service, mock(AuthCookieService.class), new OAuth2Properties("http://localhost:3000"));
		var response = new MockHttpServletResponse();
		handler.onAuthenticationSuccess(new MockHttpServletRequest(), response, googleAuthentication());
		assertThat(response.getRedirectedUrl()).isEqualTo("http://localhost:3000/auth/callback?status=success");
	}

	@Test
	void redirectsWithSanitizedErrorWhenSocialAuthenticationFailsUnexpectedly() throws Exception {
		AuthService authService = mock(AuthService.class);
		AuthCookieService authCookieService = mock(AuthCookieService.class);
		when(authService.authenticateSocialAccount(any(SocialProfile.class)))
				.thenThrow(new IllegalStateException("Redis connection unavailable"));
		OAuth2LoginSuccessHandler handler = new OAuth2LoginSuccessHandler(
				authService,
			authCookieService,
				new OAuth2Properties("http://localhost:3000")
		);
		MockHttpServletRequest request = new MockHttpServletRequest();
		request.getSession();
		MockHttpServletResponse response = new MockHttpServletResponse();

		handler.onAuthenticationSuccess(request, response, googleAuthentication());

		assertThat(response.getRedirectedUrl())
				.isEqualTo("http://localhost:3000/auth/callback?status=error&code=OAUTH2_AUTHENTICATION_FAILED");
		assertThat(request.getSession(false)).isNull();
		verifyNoInteractions(authCookieService);
	}

	private OAuth2AuthenticationToken googleAuthentication() {
		OidcIdToken idToken = new OidcIdToken(
				"google-id-token",
				Instant.now(),
				Instant.now().plusSeconds(300),
				Map.of(
						"sub", "google-subject-123",
						"email", "google.user@example.com",
						"name", "Google User",
						"email_verified", true,
						"picture", "https://lh3.googleusercontent.com/a/photo"
				)
		);
		DefaultOidcUser user = new DefaultOidcUser(
				List.of(new SimpleGrantedAuthority("OIDC_USER")),
				idToken,
				"sub"
		);
		return new OAuth2AuthenticationToken(user, user.getAuthorities(), "google");
	}
}
