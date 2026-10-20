package com.techverse.server.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(BusinessException.class)
	ResponseEntity<ApiError> handleBusinessException(BusinessException exception, HttpServletRequest request) {
		return error(exception.getErrorCode(), request, null);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiError> handleValidationException(
			MethodArgumentNotValidException exception,
			HttpServletRequest request
	) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
			fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
		}
		exception.getBindingResult().getGlobalErrors().forEach(error ->
				fieldErrors.putIfAbsent("confirmPassword", error.getDefaultMessage()));

		ApiError body = new ApiError(
				400,
				"VALIDATION_ERROR",
				"Request validation failed",
				Instant.now(),
				request.getRequestURI(),
				fieldErrors
		);
		return ResponseEntity.badRequest().body(body);
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	ResponseEntity<ApiError> handleDataIntegrityViolation(
			DataIntegrityViolationException exception,
			HttpServletRequest request
	) {
		return error(ErrorCode.DATA_CONFLICT, request, null);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiError> handleUnexpectedException(Exception exception, HttpServletRequest request) {
		log.error("Unexpected error for {}", request.getRequestURI(), exception);
		return error(ErrorCode.INTERNAL_ERROR, request, null);
	}

	private ResponseEntity<ApiError> error(ErrorCode errorCode, HttpServletRequest request, Map<String, String> fieldErrors) {
		ApiError body = new ApiError(
				errorCode.getStatus().value(),
				errorCode.getCode(),
				errorCode.getMessage(),
				Instant.now(),
				request.getRequestURI(),
				fieldErrors
		);
		return ResponseEntity.status(errorCode.getStatus()).body(body);
	}
}
