package com.techverse.server.entity;

import com.techverse.server.enums.AuthorReviewDecision;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// Append-only: created once per admin decision, never modified; content is snapshotted at review time.
@Getter
@Entity
@Table(name = "author_application_reviews")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuthorApplicationReview extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "author_profile_id", nullable = false, updatable = false)
	private AuthorProfile authorProfile;

	@Column(name = "application_version", nullable = false, updatable = false)
	private long applicationVersion;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20, updatable = false)
	private AuthorReviewDecision decision;

	@Column(name = "review_note", columnDefinition = "text", updatable = false)
	private String reviewNote;

	@Column(name = "reviewed_at", nullable = false, updatable = false)
	private Instant reviewedAt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "reviewed_by", updatable = false)
	private User reviewedBy;

	@Column(name = "reviewer_name_snapshot", nullable = false, length = 150, updatable = false)
	private String reviewerNameSnapshot;

	@Column(name = "bio_snapshot", nullable = false, columnDefinition = "text", updatable = false)
	private String bioSnapshot;

	@Column(name = "expertise_snapshot", nullable = false, length = 255, updatable = false)
	private String expertiseSnapshot;

	@Column(name = "portfolio_url_snapshot", columnDefinition = "text", updatable = false)
	private String portfolioUrlSnapshot;

	// Must be called before AuthorProfile.review mutates the profile: snapshots the content and version under review.
	public static AuthorApplicationReview of(AuthorProfile profile, AuthorReviewDecision decision, User reviewer, String note, Instant reviewedAt) {
		AuthorApplicationReview review = new AuthorApplicationReview();
		review.authorProfile = profile;
		review.applicationVersion = profile.getVersion();
		review.decision = decision;
		review.reviewNote = note;
		review.reviewedAt = reviewedAt;
		review.reviewedBy = reviewer;
		review.reviewerNameSnapshot = reviewer.getFullName();
		review.bioSnapshot = profile.getBio();
		review.expertiseSnapshot = profile.getExpertise();
		review.portfolioUrlSnapshot = profile.getPortfolioUrl();
		return review;
	}
}
