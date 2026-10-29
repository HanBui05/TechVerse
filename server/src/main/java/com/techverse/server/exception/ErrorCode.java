package com.techverse.server.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
	EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT, "AUTH_EMAIL_ALREADY_REGISTERED", "Email is already registered"),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS", "Email or password is invalid"),
	SOCIAL_PROFILE_INVALID(HttpStatus.BAD_REQUEST, "AUTH_SOCIAL_PROFILE_INVALID", "Google profile is invalid or email is not verified"),
	SOCIAL_EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT, "AUTH_SOCIAL_EMAIL_ALREADY_REGISTERED", "Email is already registered with a local account"),
	SOCIAL_ACCOUNT_INACTIVE(HttpStatus.UNAUTHORIZED, "AUTH_SOCIAL_ACCOUNT_INACTIVE", "Social account is inactive"),
	USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"),
	TOPIC_NOT_FOUND(HttpStatus.NOT_FOUND, "TOPIC_NOT_FOUND", "Topic not found"),
	TOPIC_EXISTED(HttpStatus.CONFLICT, "TOPIC_EXISTED", "Topic name already exists"),
	TAG_NOT_FOUND(HttpStatus.NOT_FOUND, "TAG_NOT_FOUND", "Tag not found"),
	TAG_EXISTED(HttpStatus.CONFLICT, "TAG_EXISTED", "Tag name already exists"),
	USER_INACTIVE(HttpStatus.FORBIDDEN, "USER_INACTIVE", "User account is inactive"),
	INVALID_USER_SELECTION(HttpStatus.BAD_REQUEST, "INVALID_USER_SELECTION", "User selection contains duplicate IDs"),
	ADMIN_SELF_LOCK_NOT_ALLOWED(HttpStatus.CONFLICT, "ADMIN_SELF_LOCK_NOT_ALLOWED", "An administrator cannot lock their own account"),
	LAST_ACTIVE_ADMIN_CANNOT_BE_LOCKED(HttpStatus.CONFLICT, "LAST_ACTIVE_ADMIN_CANNOT_BE_LOCKED", "At least one active administrator must remain"),
	AUTHOR_PROFILE_ALREADY_EXISTS(HttpStatus.CONFLICT, "AUTHOR_PROFILE_ALREADY_EXISTS", "Author profile application already exists"),
	AUTHOR_APPLICATION_NOT_FOUND(HttpStatus.NOT_FOUND, "AUTHOR_APPLICATION_NOT_FOUND", "Author application not found"),
	AUTHOR_APPLICATION_ALREADY_REVIEWED(HttpStatus.CONFLICT, "AUTHOR_APPLICATION_ALREADY_REVIEWED", "Only pending applications can be reviewed"),
	AUTHOR_APPLICATION_STALE_VERSION(HttpStatus.CONFLICT, "AUTHOR_APPLICATION_STALE_VERSION", "Application has changed. Reload it before continuing"),
	AUTHOR_SELF_REVIEW_NOT_ALLOWED(HttpStatus.FORBIDDEN, "AUTHOR_SELF_REVIEW_NOT_ALLOWED", "You cannot review your own application"),
	AUTHOR_APPLICATION_RESUBMIT_NOT_ALLOWED(HttpStatus.CONFLICT, "AUTHOR_APPLICATION_RESUBMIT_NOT_ALLOWED", "Only rejected applications can be resubmitted"),
	AUTHOR_NOT_APPROVED(HttpStatus.CONFLICT, "AUTHOR_NOT_APPROVED", "Only approved authors can be suspended"),
	AUTHOR_NOT_SUSPENDED(HttpStatus.CONFLICT, "AUTHOR_NOT_SUSPENDED", "Only suspended authors can be restored"),
	AUTHOR_SELF_STATUS_CHANGE_NOT_ALLOWED(HttpStatus.FORBIDDEN, "AUTHOR_SELF_STATUS_CHANGE_NOT_ALLOWED", "You cannot suspend or restore your own author profile"),
	ACCESS_TOKEN_REQUIRED(HttpStatus.UNAUTHORIZED, "AUTH_ACCESS_TOKEN_REQUIRED", "Access token is required"),
	INVALID_ACCESS_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_ACCESS_TOKEN", "Access token is invalid, expired, or revoked"),
	INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired"),
	INVALID_RESET_OTP(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_RESET_OTP", "OTP is invalid, expired, or already used"),
	INVALID_PASSWORD_RESET_TOKEN(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_PASSWORD_RESET_TOKEN", "Password reset token is invalid, expired, or already used"),
	PASSWORD_RESET_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "AUTH_PASSWORD_RESET_RATE_LIMITED", "Too many password reset attempts. Please try again later"),
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
