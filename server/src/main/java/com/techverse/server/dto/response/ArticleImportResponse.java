package com.techverse.server.dto.response;

import lombok.Builder;

import java.util.List;

@Builder
/** {@code warnings} stays for the legacy editor until Task 2a moves to {@code imageIssues}. */
public record ArticleImportResponse(
        String filename,
        String content,
        List<String> warnings,
        List<ArticleImageIssueResponse> imageIssues) {}
