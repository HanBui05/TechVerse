package com.techverse.server.dto.response;

import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminUserStatusUpdateResponse {

	private final boolean active;
	private final int requestedCount;
	private final int changedCount;
	private final int unchangedCount;
	private final List<UserStatus> users;

	@Getter
	@Builder
	public static class UserStatus {
		private final UUID userId;
		private final boolean active;
	}
}
