package com.techverse.server.dto.response;

import com.techverse.server.entity.AuthorApplicationReview;
import com.techverse.server.enums.AuthorReviewDecision;
import java.time.Instant;
import java.util.UUID;

public record AdminAuthorReviewHistoryResponse(
		AuthorReviewDecision decision, String reviewNote, long applicationVersion,
		String bioSnapshot, String expertiseSnapshot, String portfolioUrlSnapshot, Instant reviewedAt,
		UUID reviewedBy, String reviewerNameSnapshot
) {
	public static AdminAuthorReviewHistoryResponse from(AuthorApplicationReview review) {
		// getId() on the lazy proxy reads the FK without loading the reviewer.
		UUID reviewer = review.getReviewedBy() == null ? null : review.getReviewedBy().getId();
		return new AdminAuthorReviewHistoryResponse(review.getDecision(), review.getReviewNote(), review.getApplicationVersion(),
				review.getBioSnapshot(), review.getExpertiseSnapshot(), review.getPortfolioUrlSnapshot(), review.getReviewedAt(),
				reviewer, review.getReviewerNameSnapshot());
	}
}
