package com.techverse.server.event;

import lombok.Builder;

import java.util.UUID;

@Builder
public record GoogleAvatarImportEvent(UUID userId, String pictureUrl, String expectedAvatar) {}
