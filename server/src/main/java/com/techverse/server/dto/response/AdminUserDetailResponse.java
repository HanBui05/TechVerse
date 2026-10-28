package com.techverse.server.dto.response;

import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.SocialProvider;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminUserDetailResponse {

	private final UUID id;
	private final String fullName;
	private final String email;
	private final String phoneNumber;
	private final LocalDate dateOfBirth;
	private final String avatarUrl;
	private final boolean active;
	private final List<RoleName> roles;
	private final boolean hasLocalPassword;
	private final List<SocialProvider> socialProviders;
	private final AdminAuthorProfileResponse authorProfile;
	private final Instant createdAt;
	private final Instant updatedAt;
}
