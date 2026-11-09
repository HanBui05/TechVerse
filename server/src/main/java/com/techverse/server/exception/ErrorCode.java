package com.techverse.server.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
	ARTICLE_NOT_PENDING(HttpStatus.CONFLICT, "ARTICLE_NOT_PENDING", "Only pending articles can be reviewed"),
	ARTICLE_REVIEW_STALE(HttpStatus.CONFLICT, "ARTICLE_REVIEW_STALE", "Article has changed. Reload it before reviewing"),
	ARTICLE_SELF_REVIEW_NOT_ALLOWED(HttpStatus.FORBIDDEN, "ARTICLE_SELF_REVIEW_NOT_ALLOWED", "You cannot review your own article"),
	ARTICLE_REVIEW_NOTE_REQUIRED(HttpStatus.BAD_REQUEST, "ARTICLE_REVIEW_NOTE_REQUIRED", "Feedback is required when requesting changes"),
	ARTICLE_AUTHOR_INELIGIBLE(HttpStatus.CONFLICT, "ARTICLE_AUTHOR_INELIGIBLE", "Publication requires an active account with approved Author permission"),
	AVATAR_IMAGE_INVALID(HttpStatus.BAD_REQUEST, "AVATAR_IMAGE_INVALID", "Image is empty, corrupt, or exceeds the allowed dimensions"),
	AVATAR_FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "AVATAR_FILE_TOO_LARGE", "Avatar exceeds the size limit (5 MiB source)"),
	AVATAR_FILE_UNSUPPORTED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "AVATAR_FILE_UNSUPPORTED", "Avatar must be a static JPEG, PNG or WebP image"),
	AVATAR_STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "AVATAR_STORAGE_UNAVAILABLE", "Avatar storage is temporarily unavailable"),
	AVATAR_UPLOAD_FAILED(HttpStatus.BAD_GATEWAY, "AVATAR_UPLOAD_FAILED", "Avatar provider rejected the operation"),
	AVATAR_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "AVATAR_RATE_LIMITED", "Too many avatar uploads; please try again later"),
	ARTICLE_NOT_FOUND(HttpStatus.NOT_FOUND, "ARTICLE_NOT_FOUND", "Article not found"),
	ARTICLE_NOT_EDITABLE(HttpStatus.CONFLICT, "ARTICLE_NOT_EDITABLE", "The current state does not allow editing"),
	ARTICLE_ASSOCIATION_INACTIVE(HttpStatus.CONFLICT, "ARTICLE_ASSOCIATION_INACTIVE", "Selected topic or tag is inactive"),
	ARTICLE_IMAGE_INVALID(HttpStatus.BAD_REQUEST, "ARTICLE_IMAGE_INVALID", "Image must be a managed image belonging to this article"),
	ARTICLE_CONTENT_INVALID(HttpStatus.BAD_REQUEST, "ARTICLE_CONTENT_INVALID", "Content contains unsupported HTML or unsafe links"),
	ARTICLE_FILE_INVALID(HttpStatus.BAD_REQUEST, "ARTICLE_FILE_INVALID", "File is empty, binary, or not valid UTF-8"),
	ARTICLE_FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "ARTICLE_FILE_TOO_LARGE", "File or article content exceeds the size limit"),
	ARTICLE_FILE_UNSUPPORTED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "ARTICLE_FILE_UNSUPPORTED", "Unsupported file type"),
	ARTICLE_KEY_CONFLICT(HttpStatus.CONFLICT, "ARTICLE_KEY_CONFLICT", "This request key was used or its article was deleted"),
	ARTICLE_REQUEST_IN_PROGRESS(HttpStatus.CONFLICT, "ARTICLE_REQUEST_IN_PROGRESS", "Creation is still in progress; retry with the same key"),
	ARTICLE_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "ARTICLE_RATE_LIMITED", "Article upload/import rate limit exceeded"),
	ARTICLE_STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "ARTICLE_STORAGE_UNAVAILABLE", "Article storage is temporarily unavailable"),
	ARTICLE_NO_CHANGES(HttpStatus.CONFLICT, "ARTICLE_NO_CHANGES", "There are no changes to submit"),
	ARTICLE_NOT_WITHDRAWABLE(HttpStatus.CONFLICT, "ARTICLE_NOT_WITHDRAWABLE", "Only a pending revision can be withdrawn"),
	ARTICLE_NOT_DISCARDABLE(HttpStatus.CONFLICT, "ARTICLE_NOT_DISCARDABLE", "There is no editable revision to discard"),
	ARTICLE_NOT_DELETABLE(HttpStatus.CONFLICT, "ARTICLE_NOT_DELETABLE", "The article cannot be deleted in its current state"),
	ARTICLE_PUBLICATION_TRANSITION_INVALID(HttpStatus.CONFLICT, "ARTICLE_PUBLICATION_TRANSITION_INVALID", "The publication state does not allow this action"),
	ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED(HttpStatus.CONFLICT, "ARTICLE_AUTHOR_UNHIDE_NOT_ALLOWED", "A moderator hid this article, so you cannot unhide it"),
	ARTICLE_PUBLICATION_NOTE_REQUIRED(HttpStatus.BAD_REQUEST, "ARTICLE_PUBLICATION_NOTE_REQUIRED", "A reason is required to hide or remove an article"),
	ARTICLE_IMAGE_UPLOAD_FAILED(HttpStatus.BAD_GATEWAY, "ARTICLE_IMAGE_UPLOAD_FAILED", "Image provider rejected the operation"),
	COURSE_CONTENT_INVALID(HttpStatus.BAD_REQUEST, "COURSE_CONTENT_INVALID", "Course description contains unsupported HTML or unsafe links"),
	COURSE_FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "COURSE_FILE_TOO_LARGE", "Course content exceeds the size limit"),
	COURSE_TAXONOMY_INACTIVE(HttpStatus.CONFLICT, "COURSE_TAXONOMY_INACTIVE", "Selected topic or tag is inactive"),
	COURSE_NOT_EDITABLE(HttpStatus.CONFLICT, "COURSE_NOT_EDITABLE", "The current state does not allow editing"),
	COURSE_NOT_READY(HttpStatus.CONFLICT, "COURSE_NOT_READY", "The course is not ready to be submitted for review"),
	COURSE_NO_CHANGES(HttpStatus.CONFLICT, "COURSE_NO_CHANGES", "There are no changes to submit"),
	COURSE_NOT_PENDING(HttpStatus.CONFLICT, "COURSE_NOT_PENDING", "Only pending courses can be reviewed"),
	COURSE_NOT_WITHDRAWABLE(HttpStatus.CONFLICT, "COURSE_NOT_WITHDRAWABLE", "Only a pending revision can be withdrawn"),
	COURSE_PUBLICATION_TRANSITION_INVALID(HttpStatus.CONFLICT, "COURSE_PUBLICATION_TRANSITION_INVALID", "The publication state does not allow this action"),
	COURSE_NOT_FOUND(HttpStatus.NOT_FOUND, "COURSE_NOT_FOUND", "Course not found"),
	LESSON_NOT_FOUND(HttpStatus.NOT_FOUND, "LESSON_NOT_FOUND", "Lesson not found"),
	COURSE_ORDER_INVALID(HttpStatus.BAD_REQUEST, "COURSE_ORDER_INVALID", "Order must list every active chapter or lesson exactly once"),
	COURSE_KEY_CONFLICT(HttpStatus.CONFLICT, "COURSE_KEY_CONFLICT", "This request key was used for other data or its resource was deleted"),
	COURSE_REQUEST_IN_PROGRESS(HttpStatus.CONFLICT, "COURSE_REQUEST_IN_PROGRESS", "The request is still in progress; retry with the same key"),
	COURSE_NOT_DISCARDABLE(HttpStatus.CONFLICT, "COURSE_NOT_DISCARDABLE", "There is no editable revision to discard"),
	COURSE_NOT_DELETABLE(HttpStatus.CONFLICT, "COURSE_NOT_DELETABLE", "The course cannot be deleted in its current state"),
	COURSE_AUTHOR_UNHIDE_NOT_ALLOWED(HttpStatus.CONFLICT, "COURSE_AUTHOR_UNHIDE_NOT_ALLOWED", "A moderator hid this course, so you cannot unhide it"),
	COURSE_FILE_INVALID(HttpStatus.BAD_REQUEST, "COURSE_FILE_INVALID", "File is empty, binary, or not valid UTF-8"),
	COURSE_FILE_UNSUPPORTED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "COURSE_FILE_UNSUPPORTED", "Unsupported file type"),
	COURSE_IMAGE_INVALID(HttpStatus.BAD_REQUEST, "COURSE_IMAGE_INVALID", "Image must be a managed image belonging to this course or lesson"),
	COURSE_IMAGE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "COURSE_IMAGE_TOO_LARGE", "Image exceeds the size limit (5 MiB)"),
	COURSE_IMAGE_UNSUPPORTED(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "COURSE_IMAGE_UNSUPPORTED", "Image must be a static JPEG, PNG or WebP"),
	COURSE_IMAGE_UPLOAD_FAILED(HttpStatus.BAD_GATEWAY, "COURSE_IMAGE_UPLOAD_FAILED", "Image provider rejected the operation"),
	COURSE_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "COURSE_RATE_LIMITED", "Course upload/import rate limit exceeded"),
	COURSE_STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "COURSE_STORAGE_UNAVAILABLE", "Course storage is temporarily unavailable"),
	LESSON_CONTENT_REQUIRED(HttpStatus.BAD_REQUEST, "LESSON_CONTENT_REQUIRED", "A lesson needs a video or content"),
	LESSON_VIDEO_INVALID(HttpStatus.BAD_REQUEST, "LESSON_VIDEO_INVALID", "Invalid YouTube link"),
	COURSE_REVIEW_STALE(HttpStatus.CONFLICT, "COURSE_REVIEW_STALE", "Course has changed. Reload it before reviewing"),
	COURSE_SELF_REVIEW_NOT_ALLOWED(HttpStatus.FORBIDDEN, "COURSE_SELF_REVIEW_NOT_ALLOWED", "You cannot review your own course"),
	COURSE_AUTHOR_INELIGIBLE(HttpStatus.CONFLICT, "COURSE_AUTHOR_INELIGIBLE", "Publication requires an active account with approved Author permission"),
	COURSE_REVIEW_NOTE_REQUIRED(HttpStatus.BAD_REQUEST, "COURSE_REVIEW_NOTE_REQUIRED", "Feedback is required when requesting changes"),
	COURSE_PUBLICATION_NOTE_REQUIRED(HttpStatus.BAD_REQUEST, "COURSE_PUBLICATION_NOTE_REQUIRED", "A reason is required to hide or remove a course"),
	LESSON_PREVIEW_ONLY(HttpStatus.FORBIDDEN, "LESSON_PREVIEW_ONLY", "Sign in and start the course to read this lesson"),
	COURSE_ENROLLMENT_REQUIRED(HttpStatus.CONFLICT, "COURSE_ENROLLMENT_REQUIRED", "Start the course first"),
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
	PASSWORD_CHANGE_UNAVAILABLE(HttpStatus.CONFLICT, "AUTH_PASSWORD_CHANGE_UNAVAILABLE", "This account has no local password to change"),
	CURRENT_PASSWORD_INCORRECT(HttpStatus.BAD_REQUEST, "AUTH_CURRENT_PASSWORD_INCORRECT", "Current password is incorrect"),
	NEW_PASSWORD_MUST_DIFFER(HttpStatus.BAD_REQUEST, "AUTH_NEW_PASSWORD_MUST_DIFFER", "New password must differ from the current password"),
	PASSWORD_CHANGE_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "AUTH_PASSWORD_CHANGE_RATE_LIMITED", "Too many incorrect password attempts. Please try again later"),
	ACCESS_DENIED(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "You do not have permission to access this resource"),
	DEFAULT_ROLE_NOT_FOUND(HttpStatus.INTERNAL_SERVER_ERROR, "AUTH_DEFAULT_ROLE_NOT_FOUND", "Default learner role is not configured"),
	VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Request validation failed"),
	MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Request body is malformed"),
	DATA_CONFLICT(HttpStatus.CONFLICT, "DATA_CONFLICT", "The request conflicts with existing data"),
	AI_OUTPUT_INVALID(HttpStatus.UNPROCESSABLE_CONTENT, "AI_OUTPUT_INVALID", "AI returned invalid content"),
	AI_OUTPUT_TRUNCATED(HttpStatus.UNPROCESSABLE_CONTENT, "AI_OUTPUT_TRUNCATED", "AI output was cut off by the token limit"),
	AI_RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "AI_RATE_LIMITED", "Too many AI requests; try again shortly"),
	AI_QUOTA_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "AI_QUOTA_EXCEEDED", "Daily AI allowance used up"),
	AI_CONFIGURATION_INVALID(HttpStatus.INTERNAL_SERVER_ERROR, "AI_CONFIGURATION_INVALID", "AI assist is not configured"),
	AI_PROVIDER_UNAVAILABLE(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_UNAVAILABLE", "The AI service is temporarily unavailable"),
	AI_PROVIDER_REQUEST_REJECTED(HttpStatus.BAD_GATEWAY, "AI_PROVIDER_REQUEST_REJECTED", "The AI service rejected the request"),
	AI_PROVIDER_AUTH_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_AUTH_FAILED", "The AI service is not ready"),
	AI_PROVIDER_RATE_LIMITED(HttpStatus.SERVICE_UNAVAILABLE, "AI_PROVIDER_RATE_LIMITED", "The AI service is busy"),
	AI_STORAGE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "AI_STORAGE_UNAVAILABLE", "AI assist is temporarily unavailable"),
	AI_TIMEOUT(HttpStatus.GATEWAY_TIMEOUT, "AI_TIMEOUT", "AI took too long to respond"),
	AI_GENERATION_IN_PROGRESS(HttpStatus.CONFLICT, "AI_GENERATION_IN_PROGRESS", "Another draft is already being generated"),
	AI_GENERATION_NOT_FOUND(HttpStatus.NOT_FOUND, "AI_GENERATION_NOT_FOUND", "The generation no longer exists"),
	AI_GENERATION_INVALID(HttpStatus.CONFLICT, "AI_GENERATION_INVALID", "The AI generation cannot be used for this article"),
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
