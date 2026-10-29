package com.techverse.server.dto.response;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record AdminTopicSummaryResponse(
		UUID id, String name, String description, boolean active, Instant createdAt, Instant updatedAt
) { }
