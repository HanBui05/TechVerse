package com.techverse.server.entity;

import com.techverse.server.enums.AuthorProfileStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Version;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "author_profiles")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuthorProfile extends BaseEntity {

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, unique = true)
	private User user;

	@Column(nullable = false, columnDefinition = "text")
	private String bio;

	@Column(nullable = false, length = 255)
	private String expertise;

	@Column(name = "portfolio_url", columnDefinition = "text")
	private String portfolioUrl;

	@Column(name = "review_note", columnDefinition = "text")
	private String reviewNote;

	@Column(name = "reviewed_at")
	private Instant reviewedAt;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "reviewed_by")
	private User reviewedBy;

	@Column(name = "suspension_reason", columnDefinition = "text")
	private String suspensionReason;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "suspended_by")
	private User suspendedBy;

	@Column(name = "suspended_at")
	private Instant suspendedAt;

	@Column(name = "restoration_note", columnDefinition = "text")
	private String restorationNote;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "restored_by")
	private User restoredBy;

	@Column(name = "restored_at")
	private Instant restoredAt;

	@Version
	@Column(nullable = false)
	private long version;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private AuthorProfileStatus status;

	private AuthorProfile(User user, String bio, String expertise, String portfolioUrl) {
		this.user = user;
		this.bio = bio.trim();
		this.expertise = expertise.trim();
		this.portfolioUrl = normalizeOptional(portfolioUrl);
		this.status = AuthorProfileStatus.PENDING;
	}

	public static AuthorProfile create(User user, String bio, String expertise, String portfolioUrl) {
		return new AuthorProfile(user, bio, expertise, portfolioUrl);
	}

	public void review(AuthorProfileStatus decision, User reviewer, String note, Instant reviewedAt) {
		this.status = decision;
		this.reviewedBy = reviewer;
		this.reviewNote = normalizeOptional(note);
		this.reviewedAt = reviewedAt;
	}

	public void resubmit(String bio, String expertise, String portfolioUrl) {
		this.bio = bio.strip();
		this.expertise = expertise.strip();
		this.portfolioUrl = normalizeOptional(portfolioUrl);
		this.status = AuthorProfileStatus.PENDING;
		this.reviewedBy = null;
		this.reviewedAt = null;
		this.reviewNote = null;
	}

	public void suspend(User actor, String reason, Instant at) {
		this.status = AuthorProfileStatus.SUSPENDED;
		this.suspensionReason = reason.strip();
		this.suspendedBy = actor;
		this.suspendedAt = at;
		this.restorationNote = null;
		this.restoredBy = null;
		this.restoredAt = null;
	}

	public void restore(User actor, String note, Instant at) {
		this.status = AuthorProfileStatus.APPROVED;
		this.restorationNote = note.strip();
		this.restoredBy = actor;
		this.restoredAt = at;
	}

	private String normalizeOptional(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
