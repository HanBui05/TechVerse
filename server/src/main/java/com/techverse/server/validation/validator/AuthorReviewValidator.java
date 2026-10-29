package com.techverse.server.validation.validator;

import com.techverse.server.dto.request.ReviewAuthorApplicationRequest;
import com.techverse.server.enums.AuthorReviewDecision;
import com.techverse.server.validation.annotation.ValidAuthorReview;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class AuthorReviewValidator implements ConstraintValidator<ValidAuthorReview, ReviewAuthorApplicationRequest> {
	@Override
	public boolean isValid(ReviewAuthorApplicationRequest request, ConstraintValidatorContext context) {
		if (request == null || request.decision() != AuthorReviewDecision.REJECTED
				|| request.reviewNote() != null && !request.reviewNote().isBlank()) {
			return true;
		}
		context.disableDefaultConstraintViolation();
		context.buildConstraintViolationWithTemplate(context.getDefaultConstraintMessageTemplate())
				.addPropertyNode("reviewNote").addConstraintViolation();
		return false;
	}
}
