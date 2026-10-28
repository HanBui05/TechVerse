package com.techverse.server.enums;

public enum AdminUserSortBy {
	CREATED_AT("createdAt"),
	FULL_NAME("fullName"),
	EMAIL("email");

	private final String property;

	AdminUserSortBy(String property) {
		this.property = property;
	}

	public String getProperty() {
		return property;
	}
}
