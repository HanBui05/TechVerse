package com.techverse.server.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.validation.BindException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(CustomException.class)
	ResponseEntity<ErrorResponse> handleCustomException(CustomException exception, HttpServletRequest request) {
		return error(exception.getErrorCode(), request, null);
	}

	@ExceptionHandler(AuthorizationDeniedException.class)
	ResponseEntity<ErrorResponse> handleAuthorizationDenied(HttpServletRequest request) {
		return error(ErrorCode.ACCESS_DENIED, request, null);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ErrorResponse> handleValidationException(
			MethodArgumentNotValidException exception,
			HttpServletRequest request
	) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
			fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
		}
		exception.getBindingResult().getGlobalErrors().forEach(error ->
				fieldErrors.putIfAbsent("confirmPassword", error.getDefaultMessage()));

		return error(ErrorCode.VALIDATION_ERROR, request, fieldErrors);
	}

	@ExceptionHandler(BindException.class)
	ResponseEntity<ErrorResponse> handleBindingException(BindException exception, HttpServletRequest request) {
		Map<String, String> fieldErrors = new LinkedHashMap<>();
		for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
			fieldErrors.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
		}
		return error(ErrorCode.VALIDATION_ERROR, request, fieldErrors);
	}

	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	ResponseEntity<ErrorResponse> handleArgumentTypeMismatch(
			MethodArgumentTypeMismatchException exception,
			HttpServletRequest request
	) {
		return error(ErrorCode.VALIDATION_ERROR, request, Map.of(exception.getName(), "Invalid value"));
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	ResponseEntity<ErrorResponse> handleDataIntegrityViolation(
			DataIntegrityViolationException exception,
			HttpServletRequest request
	) {
		return error(ErrorCode.DATA_CONFLICT, request, null);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	ResponseEntity<ErrorResponse> handleMalformedRequest(HttpServletRequest request) {
		return error(ErrorCode.MALFORMED_REQUEST, request, null);
	}

	@ExceptionHandler(OptimisticLockingFailureException.class)
	ResponseEntity<ErrorResponse> handleOptimisticConflict(HttpServletRequest request) {
		return error(ErrorCode.DATA_CONFLICT, request, null);
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ErrorResponse> handleUnexpectedException(Exception exception, HttpServletRequest request) {
		log.error("Unexpected error for {}", request.getRequestURI(), exception);
		return error(ErrorCode.INTERNAL_ERROR, request, null);
	}

	private ResponseEntity<ErrorResponse> error(
			ErrorCode errorCode,
			HttpServletRequest request,
			Map<String, String> fieldErrors
	) {
		ErrorResponse body = ErrorResponse.builder()
				.status(errorCode.getStatus().value())
				.code(errorCode.getCode())
				.message(errorCode.getMessage())
				.error(errorCode.getStatus().getReasonPhrase())
				.timestamp(Instant.now())
				.path(request.getRequestURI())
				.fieldErrors(fieldErrors)
				.build();
		return ResponseEntity.status(errorCode.getStatus()).body(body);
	}
}
