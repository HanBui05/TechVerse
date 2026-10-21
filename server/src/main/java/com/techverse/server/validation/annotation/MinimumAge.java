package com.techverse.server.validation.annotation;

import com.techverse.server.validation.validator.MinimumAgeValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = MinimumAgeValidator.class)
public @interface MinimumAge {

	String message() default "User does not meet the minimum age requirement";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	int value();
}
