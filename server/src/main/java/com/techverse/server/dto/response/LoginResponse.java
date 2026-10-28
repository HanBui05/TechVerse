package com.techverse.server.dto.response;

import java.time.Instant;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponse {

	private final String accessToken;
	private final Instant expiresAt;
	private final long expiresIn;
}
