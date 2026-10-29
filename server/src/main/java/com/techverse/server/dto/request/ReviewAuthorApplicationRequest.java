package com.techverse.server.dto.request;

import com.techverse.server.enums.AuthorReviewDecision;
import com.techverse.server.validation.annotation.ValidAuthorReview;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@ValidAuthorReview
public record ReviewAuthorApplicationRequest(
		@NotNull(message = "Decision is required") AuthorReviewDecision decision,
		@Size(max = 2000, message = "Review note must not exceed 2000 characters") String reviewNote,
		@NotNull(message = "Expected version is required")
		@Min(value = 0, message = "Expected version must be nonnegative") Long expectedVersion
) {
	public ReviewAuthorApplicationRequest {
		reviewNote = reviewNote == null || reviewNote.isBlank() ? null : reviewNote.strip();
	}
}
