package com.techverse.server.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

@Schema(description = "Set one or more user accounts to the requested active state")
public record AdminUserStatusUpdateRequest(
		@NotEmpty(message = "At least one user ID is required")
		@Size(max = 100, message = "No more than 100 users can be updated at once")
		List<@NotNull(message = "User ID must not be null") UUID> userIds,

		@NotNull(message = "Target active state is required")
		@Schema(description = "Target state; false locks accounts and true unlocks accounts", example = "false")
		Boolean active
) {
}
