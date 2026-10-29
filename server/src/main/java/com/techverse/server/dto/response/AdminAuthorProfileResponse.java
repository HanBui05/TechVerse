package com.techverse.server.dto.response;

import com.techverse.server.enums.AuthorProfileStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminAuthorProfileResponse {

	private final UUID id;
	private final String bio;
	private final String expertise;
	private final String portfolioUrl;
	private final AuthorProfileStatus status;
	private final long version;
	private final String reviewNote;
	private final Instant reviewedAt;
	private final String suspensionReason;
	private final UUID suspendedBy;
	private final Instant suspendedAt;
	private final String restorationNote;
	private final UUID restoredBy;
	private final Instant restoredAt;
	private final Instant createdAt;
	private final Instant updatedAt;
}
