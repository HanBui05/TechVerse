package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.UUID;

@Builder
public record ArticleOptionResponse(UUID id, String name, boolean active) {}
