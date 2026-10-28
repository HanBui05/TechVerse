package com.techverse.server.entity;

import com.techverse.server.enums.SocialProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(
		name = "social_accounts",
		uniqueConstraints = {
				@UniqueConstraint(
						name = "uq_social_accounts_provider_identity",
						columnNames = {"provider", "provider_id"}
				),
				@UniqueConstraint(
						name = "uq_social_accounts_user_provider",
						columnNames = {"user_id", "provider"}
				)
		}
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SocialAccount extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private SocialProvider provider;

	@Column(name = "provider_id", nullable = false, length = 255)
	private String providerId;

	private SocialAccount(User user, SocialProvider provider, String providerId) {
		this.user = user;
		this.provider = provider;
		this.providerId = providerId;
	}

	public static SocialAccount link(User user, SocialProvider provider, String providerId) {
		return new SocialAccount(user, provider, providerId);
	}
}
