package com.techverse.server.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ArticleSortBy {
    CREATED_AT("createdAt"),
    UPDATED_AT("updatedAt"),
    TITLE("title");
    private final String property;
}
