package com.techverse.server.validation.annotation;

import com.techverse.server.validation.validator.PasswordConfirmationMatchesValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PasswordConfirmationMatchesValidator.class)
public @interface PasswordConfirmationMatches {

	String message() default "Password confirmation must match password";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};
}
