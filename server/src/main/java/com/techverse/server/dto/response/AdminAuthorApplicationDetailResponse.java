package com.techverse.server.dto.response;

import com.techverse.server.enums.AuthorProfileStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;

@Builder
public record AdminAuthorApplicationDetailResponse(
		UUID id, UUID userId, String fullName, String email, boolean active,
		String bio, String expertise, String portfolioUrl, AuthorProfileStatus status, long version,
		String reviewNote, UUID reviewedBy, String reviewerName, Instant reviewedAt,
		String suspensionReason, UUID suspendedBy, Instant suspendedAt,
		String restorationNote, UUID restoredBy, Instant restoredAt,
		Instant createdAt, Instant updatedAt
) { }
