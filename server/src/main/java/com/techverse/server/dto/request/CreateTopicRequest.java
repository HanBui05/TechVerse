package com.techverse.server.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTopicRequest(
		@NotBlank(message = "Topic name is required")
		@Size(max = 100, message = "Topic name must not exceed 100 characters")
		@Schema(example = "Backend") String name,
		@Size(max = 500, message = "Topic description must not exceed 500 characters")
		@Schema(example = "Server-side development and architecture") String description
) {
	public CreateTopicRequest {
		name = name == null ? null : name.strip();
		description = description == null || description.isBlank() ? null : description.strip();
	}
}
