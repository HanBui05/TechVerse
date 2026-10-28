package com.techverse.server.validation.validator;

import com.techverse.server.dto.internal.PasswordConfirmation;
import com.techverse.server.validation.annotation.PasswordConfirmationMatches;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.util.Objects;

public class PasswordConfirmationMatchesValidator
		implements ConstraintValidator<PasswordConfirmationMatches, PasswordConfirmation> {

	@Override
	public boolean isValid(PasswordConfirmation request, ConstraintValidatorContext context) {
		return request == null || Objects.equals(request.password(), request.confirmPassword());
	}
}
