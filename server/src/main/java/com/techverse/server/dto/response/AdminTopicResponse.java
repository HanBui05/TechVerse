package com.techverse.server.dto.response;

import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record AdminTopicResponse(
		UUID id, String name, String description, boolean active,
		Instant createdAt, UUID createdBy, Instant updatedAt, UUID updatedBy
) { }
