package com.techverse.server.properties;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
		@NotBlank String secretKey,
		@NotBlank String issuer,
		@NotNull Duration accessTokenExpiration,
		@NotNull Duration refreshTokenExpiration,
		boolean refreshCookieSecure
) {
}
