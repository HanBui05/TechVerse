package com.techverse.server.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
	AVATAR_IMAGE_INVALID(HttpStatus.BAD_REQUEST, "AVATAR_IMAGE_INVALID", "Image is empty, corrupt, or exceeds the allowed dimensions"),
	AVATAR_FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "AVATAR_FILE_TOO_LARGE", "Avatar exceeds the size limit (5 MiB source)"),
	AVATAR_FILE_UNSUPPORTED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "AVATAR_FILE_UNSUPPORTED", "Avatar must be a static JPEG, PNG or WebP image"),
	AVATAR_STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "AVATAR_STORAGE_UNAVAILABLE", "Avatar storage is temporarily unavailable"),
	AVATAR_UPLOAD_FAILED(HttpStatus.BAD_GATEWAY, "AVATAR_UPLOAD_FAILED", "Avatar provider rejected the operation"),
	AVATAR_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "AVATAR_RATE_LIMITED", "Too many avatar uploads; please try again later"),
	ARTICLE_NOT_FOUND(HttpStatus.NOT_FOUND, "ARTICLE_NOT_FOUND", "Article not found"),
	ARTICLE_NOT_EDITABLE(HttpStatus.CONFLICT, "ARTICLE_NOT_EDITABLE", "Only drafts or changes-requested articles can be edited or submitted"),
	ARTICLE_ASSOCIATION_INACTIVE(HttpStatus.CONFLICT, "ARTICLE_ASSOCIATION_INACTIVE", "Selected topic or tag is inactive"),
	ARTICLE_IMAGE_INVALID(HttpStatus.BAD_REQUEST, "ARTICLE_IMAGE_INVALID", "Image must be a managed image belonging to this article"),
	ARTICLE_CONTENT_INVALID(HttpStatus.BAD_REQUEST, "ARTICLE_CONTENT_INVALID", "Content contains unsupported HTML or unsafe links"),
	ARTICLE_FILE_INVALID(HttpStatus.BAD_REQUEST, "ARTICLE_FILE_INVALID", "File is empty, binary, or not valid UTF-8"),
	ARTICLE_FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "ARTICLE_FILE_TOO_LARGE", "File or article content exceeds the size limit"),
	ARTICLE_FILE_UNSUPPORTED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "ARTICLE_FILE_UNSUPPORTED", "Unsupported file type"),
	ARTICLE_KEY_CONFLICT(HttpStatus.CONFLICT, "ARTICLE_KEY_CONFLICT", "This request key was already used for different content"),
	ARTICLE_REQUEST_IN_PROGRESS(HttpStatus.CONFLICT, "ARTICLE_REQUEST_IN_PROGRESS", "Creation is still in progress; retry with the same key"),
	ARTICLE_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "ARTICLE_RATE_LIMITED", "Article upload/import rate limit exceeded"),
	ARTICLE_STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "ARTICLE_STORAGE_UNAVAILABLE", "Article storage is temporarily unavailable"),
	ARTICLE_IMAGE_UPLOAD_FAILED(HttpStatus.BAD_GATEWAY, "ARTICLE_IMAGE_UPLOAD_FAILED", "Image provider rejected the operation"),
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
