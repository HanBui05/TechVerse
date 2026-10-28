package com.techverse.server.dto.internal;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginTokens {

	private final JwtDetails accessToken;
	private final JwtDetails refreshToken;
}
