package com.techverse.server.dto.response;

import com.techverse.server.enums.AuthorProfileStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record AdminAuthorApplicationSummaryResponse(
		UUID id, UUID userId, String fullName, String email, boolean active,
		String expertise, AuthorProfileStatus status, long version, Instant createdAt, Instant updatedAt
) { }
