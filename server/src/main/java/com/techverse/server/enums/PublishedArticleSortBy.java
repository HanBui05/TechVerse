package com.techverse.server.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import org.springframework.data.domain.Sort;

/** Reader list order by first publication time; ties broken by id in the same direction. */
@Getter
@RequiredArgsConstructor
public enum PublishedArticleSortBy {
    NEWEST(Sort.Direction.DESC),
    OLDEST(Sort.Direction.ASC);

    private final Sort.Direction direction;
}
