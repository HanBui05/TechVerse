package com.techverse.server.exception;

import java.time.Instant;
import java.util.Map;

public record ApiError(
		int status,
		String code,
		String message,
		Instant timestamp,
		String path,
		Map<String, String> fieldErrors
) {
}
