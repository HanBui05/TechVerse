package com.techverse.server.dto.response;

import java.util.UUID;

/** status is CANCELLED (was running) or ALREADY_FINISHED. */
public record AiGenerationStatusResponse(UUID generationId, String status) {}
