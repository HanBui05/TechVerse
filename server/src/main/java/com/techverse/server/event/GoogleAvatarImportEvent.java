package com.techverse.server.event;

import java.util.UUID;
import lombok.Builder;

@Builder
public record GoogleAvatarImportEvent(UUID userId, String pictureUrl, String expectedAvatar) { }
