package com.techverse.server.dto.internal;

import com.techverse.server.dto.response.ArticleResponse;

import lombok.Builder;

import java.util.UUID;

@Builder
public record ArticleCreationReceipt(
        String fingerprint, UUID articleId, ArticleResponse response, boolean complete) {}
