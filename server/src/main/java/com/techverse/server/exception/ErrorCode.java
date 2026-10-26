package com.techverse.server.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
	EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT, "AUTH_EMAIL_ALREADY_REGISTERED", "Email is already registered"),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS", "Email or password is invalid"),
	SOCIAL_PROFILE_INVALID(HttpStatus.BAD_REQUEST, "AUTH_SOCIAL_PROFILE_INVALID", "Google profile is invalid or email is not verified"),
	SOCIAL_EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT, "AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED", "Email is already registered with a local account"),
	SOCIAL_ACCOUNT_INACTIVE(HttpStatus.UNAUTHORIZED, "AUTH_SOCIAL_ACCOUNT_INACTIVE", "Social account is inactive"),
	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"),
	USER_INACTIVE(HttpStatus.FORBIDDEN, "USER_INACTIVE", "User account is inactive"),
	AUTHOR_PROFILE_ALREADY_EXISTS(HttpStatus.CONFLICT, "AUTHOR_PROFILE_ALREADY_EXISTS", "Author profile application already exists"),
	ACCESS_TOKEN_REQUIRED(HttpStatus.UNAUTHORIZED, "AUTH_ACCESS_TOKEN_REQUIRED", "Access token is required"),
	INVALID_ACCESS_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_ACCESS_TOKEN", "Access token is invalid, expired, or revoked"),
	INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired"),
	ACCESS_DENIED(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "You do not have permission to access this resource"),
	DEFAULT_ROLE_NOT_FOUND(HttpStatus.INTERNAL_SERVER_ERROR, "AUTH_DEFAULT_ROLE_NOT_FOUND", "Default learner role is not configured"),
	VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed"),
	MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Request body is malformed"),
	DATA_CONFLICT(HttpStatus.CONFLICT, "DATA_CONFLICT", "The request conflicts with existing data"),
	INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred");

	private final HttpStatus status;
	private final String code;
	private final String message;

	ErrorCode(HttpStatus status, String code, String message) {
		this.status = status;
		this.code = code;
		this.message = message;
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getCode() {
		return code;
	}

	public String getMessage() {
		return message;
	}
}
