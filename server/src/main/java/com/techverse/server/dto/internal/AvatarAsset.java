package com.techverse.server.dto.internal;

import lombok.Builder;

@Builder
public record AvatarAsset(String publicId, String assetId, String url) {}
