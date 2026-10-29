package com.techverse.server.dto.request;

import com.techverse.server.enums.PublishedArticleSortBy;

import jakarta.validation.constraints.*;

import lombok.Getter;
import lombok.Setter;

import org.springframework.data.domain.Sort;

import java.util.UUID;

@Getter
@Setter
public class PublishedArticleFilter {
    @Size(max = 255)
    private String keyword;

    private UUID topicId;
    private UUID tagId;

    @Min(0)
    private int page = 0;

    @Min(1)
    @Max(100)
    private int size = 20;

    @NotNull private PublishedArticleSortBy sortBy = PublishedArticleSortBy.PUBLISHED_AT;
    @NotNull private Sort.Direction direction = Sort.Direction.DESC;
}
