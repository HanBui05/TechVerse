package com.techverse.server.validation.annotation;

import com.techverse.server.validation.validator.AuthorReviewValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = AuthorReviewValidator.class)
public @interface ValidAuthorReview {
	String message() default "Review note is required when rejecting an application";
	Class<?>[] groups() default {};
	Class<? extends Payload>[] payload() default {};
}
