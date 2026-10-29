package com.techverse.server.repository.specification;

import com.techverse.server.entity.Tag;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

public final class TagSpecification {

	private TagSpecification() { }

	public static Specification<Tag> hasKeyword(String keyword) {
		return (root, query, builder) -> {
			if (keyword == null || keyword.isBlank()) return builder.conjunction();
			String literal = keyword.strip().toLowerCase(Locale.ROOT)
					.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
			return builder.like(builder.lower(root.get("name").as(String.class)), "%" + literal + "%", '\\');
		};
	}

	public static Specification<Tag> hasActiveStatus(Boolean active) {
		return (root, query, builder) -> active == null
				? builder.conjunction() : builder.equal(root.get("active"), active);
	}
}
