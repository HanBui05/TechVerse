package com.techverse.server.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateTopicStatusRequest(
		@NotNull(message = "Topic active status is required") Boolean active
) { }
