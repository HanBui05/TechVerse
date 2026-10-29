package com.techverse.server.configuration;

import com.techverse.server.properties.OAuth2Properties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			@Qualifier("accessTokenDecoder") JwtDecoder accessTokenDecoder,
			Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter,
			CustomAuthenticationEntryPoint authenticationEntryPoint,
			CustomAccessDeniedHandler accessDeniedHandler,
			OAuth2LoginSuccessHandler oauth2LoginSuccessHandler,
			OAuth2LoginFailureHandler oauth2LoginFailureHandler,
			BearerTokenResolver bearerTokenResolver
	) throws Exception {
		return http
				.csrf(AbstractHttpConfigurer::disable)
				.requestCache(AbstractHttpConfigurer::disable)
				.cors(cors -> {})
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
				.oauth2Login(oauth2 -> oauth2
						.authorizedClientRepository(oauth2AuthorizedClientRepository())
						.successHandler(oauth2LoginSuccessHandler)
						.failureHandler(oauth2LoginFailureHandler))
				.oauth2ResourceServer(oauth2 -> oauth2
						.authenticationEntryPoint(authenticationEntryPoint)
						.bearerTokenResolver(bearerTokenResolver)
						.jwt(jwt -> jwt
								.decoder(accessTokenDecoder)
								.jwtAuthenticationConverter(jwtAuthenticationConverter)))
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(authenticationEntryPoint)
						.accessDeniedHandler(accessDeniedHandler))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/forgot-password", "/api/v1/auth/verify-reset-otp", "/api/v1/auth/reset-password").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/logout", "/api/v1/auth/logout-all").authenticated()
						.requestMatchers(HttpMethod.POST, "/api/v1/author-profiles/me").authenticated()
						.requestMatchers(HttpMethod.PATCH, "/api/v1/author-profiles/me/resubmit").authenticated()
						.requestMatchers(HttpMethod.GET, "/api/v1/author-profiles/me").authenticated()
						.requestMatchers(HttpMethod.GET, "/api/v1/users/me").authenticated()
						.requestMatchers(HttpMethod.PATCH, "/api/v1/users/me", "/api/v1/users/me/avatar").authenticated()
						.requestMatchers("/api/v1/admin/**").authenticated()
						.requestMatchers("/api/v1/author/articles", "/api/v1/author/articles/**").authenticated()
						.requestMatchers("/api/v1/moderator/articles", "/api/v1/moderator/articles/**").authenticated()
						.requestMatchers(HttpMethod.GET, "/api/v1/articles", "/api/v1/articles/**").authenticated()
						.requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
						.anyRequest().denyAll())
				.build();
	}

	@Bean
	OAuth2AuthorizedClientRepository oauth2AuthorizedClientRepository() {
		return new OAuth2AuthorizedClientRepository() {
			@Override
			public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(
					String clientRegistrationId,
					Authentication principal,
					HttpServletRequest request
			) {
				return null;
			}

			@Override
			public void saveAuthorizedClient(
					OAuth2AuthorizedClient authorizedClient,
					Authentication principal,
					HttpServletRequest request,
					HttpServletResponse response
			) {
				// TechVerse consumes Google identity claims once and never retains provider tokens.
			}

			@Override
			public void removeAuthorizedClient(
					String clientRegistrationId,
					Authentication principal,
					HttpServletRequest request,
					HttpServletResponse response
			) {
				// No provider token exists to remove.
			}
		};
	}

	@Bean
	BearerTokenResolver bearerTokenResolver() {
		DefaultBearerTokenResolver delegate = new DefaultBearerTokenResolver();
		return request -> isRecoveryOrRefreshRequest(request) ? null : delegate.resolve(request);
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource(OAuth2Properties oauth2Properties) {
		CorsConfiguration corsConfiguration = new CorsConfiguration();
		corsConfiguration.setAllowedOrigins(List.of(oauth2Properties.webUrl()));
		corsConfiguration.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
		corsConfiguration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key", "Upload-Key"));
		corsConfiguration.setAllowCredentials(true);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", corsConfiguration);
		return source;
	}

	private boolean isRecoveryOrRefreshRequest(HttpServletRequest request) {
		String requestPath = request.getRequestURI().substring(request.getContextPath().length());
		return HttpMethod.POST.matches(request.getMethod()) && List.of(
				"/api/v1/auth/refresh", "/api/v1/auth/forgot-password",
				"/api/v1/auth/verify-reset-otp", "/api/v1/auth/reset-password").contains(requestPath);
	}
}
