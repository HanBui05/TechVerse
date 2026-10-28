package com.techverse.server.exception;

import java.time.Instant;
import java.util.Map;
import lombok.Builder;

@Builder
public record ErrorResponse(
		int status,
		String code,
		String message,
		String error,
		Instant timestamp,
		String path,
		Map<String, String> fieldErrors
) {
}
