package com.techverse.server.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum AdminAuthorApplicationSortBy {
	CREATED_AT("createdAt"),
	UPDATED_AT("updatedAt"),
	FULL_NAME("user.fullName"),
	EMAIL("user.email");

	private final String property;
}
