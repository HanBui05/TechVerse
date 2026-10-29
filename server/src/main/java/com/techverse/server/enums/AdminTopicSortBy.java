package com.techverse.server.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum AdminTopicSortBy {
	NAME("name"),
	CREATED_AT("createdAt"),
	UPDATED_AT("updatedAt");

	private final String property;
}
