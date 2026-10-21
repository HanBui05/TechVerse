package com.techverse.server.validation.validator;

import com.techverse.server.validation.annotation.PhoneNumber;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PhoneNumberValidator implements ConstraintValidator<PhoneNumber, String> {

	private int minDigits;
	private int maxDigits;

	@Override
	public void initialize(PhoneNumber constraintAnnotation) {
		minDigits = constraintAnnotation.minDigits();
		maxDigits = constraintAnnotation.maxDigits();
	}

	@Override
	public boolean isValid(String value, ConstraintValidatorContext context) {
		if (value == null || value.isBlank()) {
			return true;
		}

		String normalized = value.trim().replaceAll("[\\s().-]", "");
		if (!normalized.matches("\\+?\\d+")) {
			return false;
		}

		int digitCount = normalized.startsWith("+") ? normalized.length() - 1 : normalized.length();
		return digitCount >= minDigits && digitCount <= maxDigits;
	}
}
