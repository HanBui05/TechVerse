package com.techverse.server.dto.internal;

import lombok.Builder;

@Builder
public record DecodedArticleImage(byte[] bytes, String fingerprint, int width, int height) {}
