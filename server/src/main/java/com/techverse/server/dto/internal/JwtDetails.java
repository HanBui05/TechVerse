package com.techverse.server.dto.internal;

import java.time.Instant;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class JwtDetails {

	private final String value;
	private final String jwtId;
	private final Instant expiresAt;
	private final long secondsTtl;
}
