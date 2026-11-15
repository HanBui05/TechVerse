package com.techverse.server.dto.response;

import java.time.Instant;
import java.util.UUID;

/** Platform commission applied to new order items; history stays in the database. */
public record CommissionPolicyResponse(UUID id, int rateBps, Instant effectiveFrom) {}
