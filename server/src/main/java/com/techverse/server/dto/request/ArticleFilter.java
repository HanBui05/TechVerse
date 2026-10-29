package com.techverse.server.dto.request;

import com.techverse.server.enums.*;

import jakarta.validation.constraints.*;

import lombok.*;

import org.springframework.data.domain.Sort;

import java.util.UUID;

@Getter
@Setter
public class ArticleFilter {
    @Size(max = 255)
    private String keyword;

    private ArticleStatus status;
    private UUID topicId;
    private UUID tagId;

    @Min(0)
    private int page = 0;

    @Min(1)
    @Max(100)
    private int size = 20;

    @NotNull private ArticleSortBy sortBy = ArticleSortBy.CREATED_AT;
    @NotNull private Sort.Direction direction = Sort.Direction.DESC;
}
