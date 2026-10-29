package com.techverse.server.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RestoreAuthorRequest(
		@NotBlank(message = "Restoration note is required")
		@Size(max = 2000, message = "Restoration note must not exceed 2000 characters") String note,
		@NotNull(message = "Expected version is required")
		@Min(value = 0, message = "Expected version must be nonnegative") Long expectedVersion
) {
	public RestoreAuthorRequest {
		note = note == null ? null : note.strip();
	}
}
