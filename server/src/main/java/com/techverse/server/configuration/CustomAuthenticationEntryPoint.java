package com.techverse.server.configuration;

import com.techverse.server.exception.ErrorResponse;
import com.techverse.server.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

	private final ObjectMapper objectMapper;

	@Override
	public void commence(
			HttpServletRequest request,
			HttpServletResponse response,
			AuthenticationException authenticationException
	) throws IOException {
		ErrorCode errorCode = request.getHeader(HttpHeaders.AUTHORIZATION) == null
				? ErrorCode.ACCESS_TOKEN_REQUIRED
				: ErrorCode.INVALID_ACCESS_TOKEN;
		writeError(response, request, errorCode);
	}

	private void writeError(HttpServletResponse response, HttpServletRequest request, ErrorCode errorCode) throws IOException {
		response.setStatus(errorCode.getStatus().value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getOutputStream(), ErrorResponse.builder()
				.status(errorCode.getStatus().value())
				.code(errorCode.getCode())
				.message(errorCode.getMessage())
				.error(errorCode.getStatus().getReasonPhrase())
				.timestamp(Instant.now())
				.path(request.getRequestURI())
				.build());
	}
}
