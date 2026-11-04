package com.techverse.server.dto.request;

import com.techverse.server.enums.ArticlePublicationAction;

import jakarta.validation.constraints.*;

/** Author sends only {@code action} (HIDE/UNHIDE); Moderator also sends token and note. */
public record ArticlePublicationRequest(
        @NotNull ArticlePublicationAction action,
        @Pattern(regexp = "[a-f0-9]{64}") String reviewToken,
        @Size(max = 2000) String moderationNote) {}
