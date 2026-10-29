package com.techverse.server.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum PublishedArticleSortBy {
    PUBLISHED_AT("publishedAt"),
    UPDATED_AT("updatedAt"),
    TITLE("title");

    private final String property;
}
