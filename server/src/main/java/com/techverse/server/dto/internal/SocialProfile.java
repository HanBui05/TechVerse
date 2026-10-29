package com.techverse.server.dto.internal;

import com.techverse.server.enums.SocialProvider;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SocialProfile {

	private final SocialProvider provider;
	private final String providerId;
	private final String email;
	private final String fullName;
	private final String pictureUrl;
	private final boolean emailVerified;
}
