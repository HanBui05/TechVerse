package com.techverse.server.configuration;

import com.nimbusds.jose.proc.SecurityContext;
import com.techverse.server.enums.TokenType;
import com.techverse.server.enums.RoleName;
import com.techverse.server.properties.JwtProperties;
import com.techverse.server.properties.OAuth2Properties;
import com.techverse.server.service.TokenService;
import com.techverse.server.service.AuthorProfileService;
import java.util.Base64;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

@Configuration
@EnableConfigurationProperties({JwtProperties.class, OAuth2Properties.class})
public class JwtConfiguration {

	@Bean
	SecretKey jwtSigningKey(JwtProperties jwtProperties) {
		byte[] keyBytes;
		try {
			keyBytes = Base64.getDecoder().decode(jwtProperties.secretKey());
		} catch (IllegalArgumentException exception) {
			throw new IllegalStateException("JWT secret key must be Base64 encoded", exception);
		}

		if (keyBytes.length < 32) {
			throw new IllegalStateException("JWT secret key must contain at least 256 bits");
		}

		return new SecretKeySpec(keyBytes, "HmacSHA256");
	}

	@Bean
	JwtEncoder jwtEncoder(SecretKey jwtSigningKey) {
		ImmutableSecret<SecurityContext> immutableSecret = new ImmutableSecret<>(jwtSigningKey);
		return new NimbusJwtEncoder(immutableSecret);
	}

	@Bean
	Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter(AuthorProfileService authorProfileService) {
		return jwt -> {
			List<String> roles = jwt.getClaimAsStringList("roles");
			// A signed role claim is not sufficient after an administrator suspends an author.
			boolean approvedAuthor = roles != null && roles.contains(RoleName.AUTHOR.name())
					&& authorProfileService.isApprovedAuthor(UUID.fromString(jwt.getSubject()));
			Collection<GrantedAuthority> authorities = roles == null
					? List.of()
					: roles.stream()
							.filter(role -> !RoleName.AUTHOR.name().equals(role) || approvedAuthor)
							.<GrantedAuthority>map(role -> new SimpleGrantedAuthority("ROLE_" + role))
							.toList();
			return new JwtAuthenticationToken(jwt, authorities);
		};
	}

	@Bean
	JwtDecoder accessTokenDecoder(SecretKey jwtSigningKey, JwtProperties jwtProperties, TokenService tokenService) {
		NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withSecretKey(jwtSigningKey)
				.macAlgorithm(MacAlgorithm.HS256)
				.build();
		OAuth2TokenValidator<org.springframework.security.oauth2.jwt.Jwt> activeAccessTokenValidator = jwt -> {
			if ("access".equals(jwt.getClaimAsString("token_type"))
					&& jwt.getId() != null
					&& tokenService.isTokenActive(jwt, TokenType.ACCESS)) {
				return OAuth2TokenValidatorResult.success();
			}
			return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
		};
		jwtDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
				JwtValidators.createDefaultWithIssuer(jwtProperties.issuer()),
				activeAccessTokenValidator
		));
		return jwtDecoder;
	}

	@Bean
	JwtDecoder refreshTokenDecoder(SecretKey jwtSigningKey, JwtProperties jwtProperties) {
		NimbusJwtDecoder jwtDecoder = NimbusJwtDecoder.withSecretKey(jwtSigningKey)
				.macAlgorithm(MacAlgorithm.HS256)
				.build();
		OAuth2TokenValidator<org.springframework.security.oauth2.jwt.Jwt> refreshTokenValidator = jwt ->
				"refresh".equals(jwt.getClaimAsString("token_type")) && jwt.getId() != null
						? OAuth2TokenValidatorResult.success()
						: OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
		jwtDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
				JwtValidators.createDefaultWithIssuer(jwtProperties.issuer()),
				refreshTokenValidator
		));
		return jwtDecoder;
	}

}
