package com.techverse.server.repository.specification;

import com.techverse.server.entity.AuthorProfile;
import com.techverse.server.enums.AuthorProfileStatus;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

public final class AuthorProfileSpecification {
	private AuthorProfileSpecification() { }

	public static Specification<AuthorProfile> hasKeyword(String keyword) {
		return (root, query, cb) -> {
			if (keyword == null || keyword.isBlank()) return cb.conjunction();
			String escaped = keyword.strip().toLowerCase(Locale.ROOT)
					.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
			String pattern = "%" + escaped + "%";
			return cb.or(
					cb.like(cb.lower(root.get("user").get("fullName")), pattern, '\\'),
					cb.like(cb.lower(root.get("user").get("email").as(String.class)), pattern, '\\'));
		};
	}

	public static Specification<AuthorProfile> hasStatus(AuthorProfileStatus status) {
		return (root, query, cb) -> status == null ? cb.conjunction() : cb.equal(root.get("status"), status);
	}

	public static Specification<AuthorProfile> hasActiveStatus(Boolean active) {
		return (root, query, cb) -> active == null ? cb.conjunction() : cb.equal(root.get("user").get("active"), active);
	}
}
