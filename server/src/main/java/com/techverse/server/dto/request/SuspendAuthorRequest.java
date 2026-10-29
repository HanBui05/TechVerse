package com.techverse.server.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SuspendAuthorRequest(
		@NotBlank(message = "Suspension reason is required")
		@Size(max = 2000, message = "Suspension reason must not exceed 2000 characters") String reason,
		@NotNull(message = "Expected version is required")
		@Min(value = 0, message = "Expected version must be nonnegative") Long expectedVersion
) {
	public SuspendAuthorRequest {
		reason = reason == null ? null : reason.strip();
	}
}
