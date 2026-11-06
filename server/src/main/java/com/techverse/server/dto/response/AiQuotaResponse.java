package com.techverse.server.dto.response;

import com.techverse.server.service.impl.AiRateLimitService.Quota;

/** Today's allowance per kind, read without reserving. */
public record AiQuotaResponse(Quota outline, Quota draft) {}
