package com.techverse.server.properties;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "sendgrid")
public record SendGridProperties(
		String apiKey,
		String fromEmail,
		String fromName,
		Map<String, String> templateId
) {
}
