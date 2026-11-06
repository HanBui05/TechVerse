package com.techverse.server.dto.request;

import jakarta.validation.*;

import java.lang.annotation.*;
import java.util.UUID;

/**
 * ARTICLE (default) needs {@code topicId} and no {@code courseId}; LESSON needs {@code courseId}
 * and must not send {@code topicId}/{@code tagIds} (the server takes the course's taxonomy).
 * Violations are reported on the field, so ARTICLE keeps {@code fieldErrors.topicId}.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = AiTarget.Validator.class)
public @interface AiTarget {
    String message() default "Invalid AI target";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    interface Request {
        String getTargetType();

        UUID getCourseId();

        UUID getTopicId();

        /** Whether the client sent the field (tagIds defaults to an empty list). */
        boolean has(String field);

        default boolean isLesson() {
            return "LESSON".equals(getTargetType());
        }
    }

    class Validator implements ConstraintValidator<AiTarget, Request> {
        @Override
        public boolean isValid(Request r, ConstraintValidatorContext ctx) {
            ctx.disableDefaultConstraintViolation();
            boolean ok = true;
            if (r.isLesson()) {
                if (r.getCourseId() == null) ok = fail(ctx, "courseId", "must not be null");
                if (r.has("topicId")) ok = fail(ctx, "topicId", "must not be sent for a lesson");
                if (r.has("tagIds")) ok = fail(ctx, "tagIds", "must not be sent for a lesson");
            } else {
                if (r.getTopicId() == null) ok = fail(ctx, "topicId", "must not be null");
                if (r.getCourseId() != null) ok = fail(ctx, "courseId", "only allowed for a lesson");
            }
            return ok;
        }

        private static boolean fail(ConstraintValidatorContext ctx, String field, String message) {
            ctx.buildConstraintViolationWithTemplate(message).addPropertyNode(field).addConstraintViolation();
            return false;
        }
    }
}
