package com.techverse.server.service;

import com.techverse.server.dto.request.AiOutlineRequest;
import com.techverse.server.dto.response.AiOutlineResponse;
import com.techverse.server.dto.response.AiQuotaResponse;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.service.impl.AiRateLimitService.Quota;

import lombok.Getter;

import java.util.UUID;

public interface AuthorAiService {

    /** Quota is the outline allowance after this call's reservation, for response headers. */
    record Outline(AiOutlineResponse body, Quota quota) {}

    /** A failure after quota was reserved; carries the allowance after the refund for headers. */
    @Getter
    class QuotaAwareException extends CustomException {
        private final Quota quota;

        public QuotaAwareException(ErrorCode errorCode, Quota quota) {
            super(errorCode);
            this.quota = quota;
        }
    }

    Outline outline(UUID actor, AiOutlineRequest request);

    /** Today's outline/draft allowance for an approved Author; reserves nothing. */
    AiQuotaResponse quota(UUID actor);
}
