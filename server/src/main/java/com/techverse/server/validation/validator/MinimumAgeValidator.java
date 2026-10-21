package com.techverse.server.validation.validator;

import com.techverse.server.validation.annotation.MinimumAge;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.LocalDate;
import java.time.Period;

public class MinimumAgeValidator implements ConstraintValidator<MinimumAge, LocalDate> {

	private int minimumAge;

	@Override
	public void initialize(MinimumAge constraintAnnotation) {
		minimumAge = constraintAnnotation.value();
	}

	@Override
	public boolean isValid(LocalDate dateOfBirth, ConstraintValidatorContext context) {
		return dateOfBirth == null || Period.between(dateOfBirth, LocalDate.now()).getYears() >= minimumAge;
	}
}
