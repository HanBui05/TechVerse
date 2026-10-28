package com.techverse.server.dto.response;

import com.techverse.server.enums.RoleName;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MyProfileResponse {

	private final UUID id;
	private final String fullName;
	private final String email;
	private final String phoneNumber;
	private final LocalDate dateOfBirth;
	private final String avatarUrl;
	private final Set<RoleName> roles;
	private final Instant createdAt;
	private final Instant updatedAt;
}
