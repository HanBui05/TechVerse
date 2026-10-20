package com.techverse.server.validation.annotation;

import com.techverse.server.validation.validator.Utf8ByteLengthValidator;
import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Documented
@Target(FIELD)
@Retention(RUNTIME)
@Constraint(validatedBy = Utf8ByteLengthValidator.class)
public @interface Utf8ByteLength {

	String message() default "Value exceeds the maximum UTF-8 byte length";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

	int max();
}
