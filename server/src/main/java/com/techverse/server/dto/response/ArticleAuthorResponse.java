package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.UUID;

@Builder
public record ArticleAuthorResponse(UUID id, String fullName, String avatarUrl) {}
