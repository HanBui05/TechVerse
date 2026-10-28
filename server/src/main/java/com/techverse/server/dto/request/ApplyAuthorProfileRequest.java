package com.techverse.server.dto.request;

import com.techverse.server.validation.annotation.OptionalHttpUrl;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApplyAuthorProfileRequest(
		@NotBlank(message = "Bio must not be blank")
		@Size(min = 50, max = 2000, message = "Bio must contain between 50 and 2000 characters")
		String bio,
		@NotBlank(message = "Expertise must not be blank")
		@Size(min = 3, max = 255, message = "Expertise must contain between 3 and 255 characters")
		String expertise,
		@Size(max = 500, message = "Portfolio URL must not exceed 500 characters")
		@OptionalHttpUrl(message = "Portfolio URL must use HTTP or HTTPS")
		String portfolioUrl
) {

	public ApplyAuthorProfileRequest {
		bio = normalizeRequired(bio);
		expertise = normalizeRequired(expertise);
		portfolioUrl = normalizeOptional(portfolioUrl);
	}

	private static String normalizeRequired(String value) {
		return value == null ? null : value.strip();
	}

	private static String normalizeOptional(String value) {
		String normalized = normalizeRequired(value);
		return normalized == null || normalized.isEmpty() ? null : normalized;
	}
}
