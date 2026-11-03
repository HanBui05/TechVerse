package com.techverse.server.dto.response;

import com.techverse.server.enums.AuthorProfileStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Builder;

@Builder
public record AdminAuthorApplicationDetailResponse(
		UUID id, UUID userId, String fullName, String email, String avatarUrl, boolean active,
		String bio, String expertise, String portfolioUrl, AuthorProfileStatus status, long version,
		String reviewNote, UUID reviewedBy, String reviewerName, Instant reviewedAt,
		String suspensionReason, UUID suspendedBy, Instant suspendedAt,
		String restorationNote, UUID restoredBy, Instant restoredAt,
		List<AdminAuthorReviewHistoryResponse> reviewHistory,
		Instant createdAt, Instant updatedAt
) { }
