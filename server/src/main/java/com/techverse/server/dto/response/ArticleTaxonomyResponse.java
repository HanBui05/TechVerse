package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.UUID;

@Builder
public record ArticleTaxonomyResponse(UUID id, String name) {}
