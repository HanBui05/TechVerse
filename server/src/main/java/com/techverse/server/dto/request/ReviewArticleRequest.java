package com.techverse.server.dto.request;

import com.techverse.server.enums.ArticleReviewDecision;

import jakarta.validation.constraints.*;

import lombok.Builder;

@Builder
public record ReviewArticleRequest(
        @NotNull ArticleReviewDecision decision,
        @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String reviewToken,
        @Size(max = 2000) String moderationNote) {}
