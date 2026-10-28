package com.techverse.server.entity;

import com.techverse.server.enums.AuthorProfileStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
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

	private String normalizeOptional(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
