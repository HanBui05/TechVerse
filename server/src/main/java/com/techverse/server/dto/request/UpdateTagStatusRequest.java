package com.techverse.server.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateTagStatusRequest(
		@NotNull(message = "Tag active status is required") Boolean active
) { }
