package com.techverse.server.validation.annotation;

import com.techverse.server.validation.validator.OptionalHttpUrlValidator;
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
@Constraint(validatedBy = OptionalHttpUrlValidator.class)
public @interface OptionalHttpUrl {

	String message() default "URL must use HTTP or HTTPS";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};
}
