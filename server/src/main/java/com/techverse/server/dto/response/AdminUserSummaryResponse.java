package com.techverse.server.dto.response;

import com.techverse.server.enums.AuthorProfileStatus;
import com.techverse.server.enums.RoleName;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminUserSummaryResponse {

	private final UUID id;
	private final String fullName;
	private final String email;
	private final List<RoleName> roles;
	private final boolean active;
	private final AuthorProfileStatus authorProfileStatus;
	private final Instant createdAt;
}
