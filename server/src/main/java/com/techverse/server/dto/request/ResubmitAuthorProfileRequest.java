package com.techverse.server.dto.request;

import com.techverse.server.validation.annotation.OptionalHttpUrl;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResubmitAuthorProfileRequest(
		@NotBlank(message = "Bio must not be blank")
		@Size(min = 50, max = 2000, message = "Bio must contain between 50 and 2000 characters") String bio,
		@NotBlank(message = "Expertise must not be blank")
		@Size(min = 3, max = 255, message = "Expertise must contain between 3 and 255 characters") String expertise,
		@Size(max = 500, message = "Portfolio URL must not exceed 500 characters")
		@OptionalHttpUrl(message = "Portfolio URL must use HTTP or HTTPS") String portfolioUrl,
		@NotNull(message = "Expected version is required")
		@Min(value = 0, message = "Expected version must be nonnegative") Long expectedVersion
) {
	public ResubmitAuthorProfileRequest {
		bio = bio == null ? null : bio.strip();
		expertise = expertise == null ? null : expertise.strip();
		portfolioUrl = portfolioUrl == null || portfolioUrl.isBlank() ? null : portfolioUrl.strip();
	}
}
