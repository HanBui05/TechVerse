package com.techverse.server.properties;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "oauth2")
public record OAuth2Properties(
		@NotBlank String webUrl
) {
}
