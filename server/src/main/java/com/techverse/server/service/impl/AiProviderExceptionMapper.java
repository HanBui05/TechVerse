package com.techverse.server.service.impl;

import com.openai.errors.OpenAIServiceException;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;

import org.springframework.stereotype.Component;

import java.io.InterruptedIOException;
import java.util.concurrent.TimeoutException;

/**
 * Maps provider/SDK failures to generic codes. The provider body, headers and message are
 * dropped on purpose: they may echo request details or key fragments.
 */
@Component
public class AiProviderExceptionMapper {

    public CustomException map(Throwable failure) {
        if (failure instanceof CustomException custom) return custom;
        return new CustomException(code(failure));
    }

    private ErrorCode code(Throwable failure) {
        for (Throwable t = failure; t != null; t = t.getCause()) {
            if (t instanceof OpenAIServiceException service) return byStatus(service.statusCode());
            if (t instanceof InterruptedIOException || t instanceof TimeoutException)
                return ErrorCode.AI_TIMEOUT;
            if (t.getCause() == t) break;
        }
        return ErrorCode.AI_PROVIDER_UNAVAILABLE;
    }

    private ErrorCode byStatus(int status) {
        return switch (status) {
            case 401, 403 -> ErrorCode.AI_PROVIDER_AUTH_FAILED;
            case 429 -> ErrorCode.AI_PROVIDER_RATE_LIMITED;
            // 498 (capacity) and 499 (client cancel) are not request-shape problems.
            case 498, 499 -> ErrorCode.AI_PROVIDER_UNAVAILABLE;
            default ->
                    status >= 400 && status < 500
                            ? ErrorCode.AI_PROVIDER_REQUEST_REJECTED
                            : ErrorCode.AI_PROVIDER_UNAVAILABLE;
        };
    }
}
