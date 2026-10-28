package com.techverse.server.repository.specification;

import com.techverse.server.entity.AuthorProfile;
import com.techverse.server.entity.Role;
import com.techverse.server.entity.User;
import com.techverse.server.entity.UserRole;
import com.techverse.server.enums.AuthorProfileStatus;
import com.techverse.server.enums.RoleName;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

public final class UserSpecification {

	private UserSpecification() {
	}

	public static Specification<User> hasKeyword(String keyword) {
		return (root, query, criteriaBuilder) -> {
			if (keyword == null || keyword.isBlank()) {
				return criteriaBuilder.conjunction();
			}

			String pattern = "%" + escapeLike(keyword.trim().toLowerCase(Locale.ROOT)) + "%";
			return criteriaBuilder.or(
					criteriaBuilder.like(criteriaBuilder.lower(root.get("fullName")), pattern, '\\'),
					criteriaBuilder.like(criteriaBuilder.lower(root.get("email").as(String.class)), pattern, '\\')
			);
		};
	}

	public static Specification<User> hasActiveStatus(Boolean active) {
		return (root, query, criteriaBuilder) -> active == null
				? criteriaBuilder.conjunction()
				: criteriaBuilder.equal(root.get("active"), active);
	}

	public static Specification<User> hasRole(RoleName roleName) {
		return (root, query, criteriaBuilder) -> {
			if (roleName == null) {
				return criteriaBuilder.conjunction();
			}

			Subquery<Integer> roleSubquery = query.subquery(Integer.class);
			Root<UserRole> userRole = roleSubquery.from(UserRole.class);
			Join<UserRole, Role> role = userRole.join("role");
			roleSubquery.select(criteriaBuilder.literal(1));
			roleSubquery.where(
					criteriaBuilder.equal(userRole.get("user").get("id"), root.get("id")),
					criteriaBuilder.equal(role.get("name"), roleName)
			);
			return criteriaBuilder.exists(roleSubquery);
		};
	}

	public static Specification<User> hasAuthorProfileStatus(AuthorProfileStatus authorStatus) {
		return (root, query, criteriaBuilder) -> {
			if (authorStatus == null) {
				return criteriaBuilder.conjunction();
			}

			Subquery<Integer> authorProfileSubquery = query.subquery(Integer.class);
			Root<AuthorProfile> authorProfile = authorProfileSubquery.from(AuthorProfile.class);
			authorProfileSubquery.select(criteriaBuilder.literal(1));
			authorProfileSubquery.where(
					criteriaBuilder.equal(authorProfile.get("user").get("id"), root.get("id")),
					criteriaBuilder.equal(authorProfile.get("status"), authorStatus)
			);
			return criteriaBuilder.exists(authorProfileSubquery);
		};
	}

	private static String escapeLike(String value) {
		return value
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}
}
