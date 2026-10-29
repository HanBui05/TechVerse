package com.techverse.server.dto.request;

import jakarta.validation.constraints.*;

import lombok.*;

@Getter
@Setter
public class ArticleOptionsFilter {
    @Size(max = 100)
    private String topicKeyword;

    @Min(0)
    private int topicPage = 0;

    @Min(1)
    @Max(100)
    private int topicSize = 20;

    @Size(max = 100)
    private String tagKeyword;

    @Min(0)
    private int tagPage = 0;

    @Min(1)
    @Max(100)
    private int tagSize = 20;
}
