package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.List;

@Builder
public record ArticleImportResponse(String filename, String content, List<String> warnings) {}
