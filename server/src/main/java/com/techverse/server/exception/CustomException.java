package com.techverse.server.exception;

import java.util.Map;
import lombok.Getter;

@Getter
public class CustomException extends RuntimeException {

	private final ErrorCode errorCode;
	private final Map<String, String> fieldErrors;

	public CustomException(ErrorCode errorCode) {
		this(errorCode, null);
	}

	public CustomException(ErrorCode errorCode, Map<String, String> fieldErrors) {
		super(errorCode.getMessage());
		this.errorCode = errorCode;
		this.fieldErrors = fieldErrors;
	}
}
