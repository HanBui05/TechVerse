package com.techverse.server.dto.response;

import com.techverse.server.entity.AuthorApplicationReview;
import com.techverse.server.enums.AuthorReviewDecision;
import java.time.Instant;

// Owner view: deliberately has no reviewer identity fields.
public record AuthorReviewHistoryResponse(
		AuthorReviewDecision decision, String reviewNote, long applicationVersion,
		String bioSnapshot, String expertiseSnapshot, String portfolioUrlSnapshot, Instant reviewedAt
) {
	public static AuthorReviewHistoryResponse from(AuthorApplicationReview review) {
		return new AuthorReviewHistoryResponse(review.getDecision(), review.getReviewNote(), review.getApplicationVersion(),
				review.getBioSnapshot(), review.getExpertiseSnapshot(), review.getPortfolioUrlSnapshot(), review.getReviewedAt());
	}
}
