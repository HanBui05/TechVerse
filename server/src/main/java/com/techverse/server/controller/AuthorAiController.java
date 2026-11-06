package com.techverse.server.controller;

import com.techverse.server.dto.request.AiDraftRequest;
import com.techverse.server.dto.request.AiOutlineRequest;
import com.techverse.server.dto.response.AiGenerationStatusResponse;
import com.techverse.server.dto.response.AiOutlineResponse;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.exception.ErrorResponse;
import com.techverse.server.service.AuthorAiService;
import com.techverse.server.service.impl.AiDraftStreamService;

import jakarta.servlet.http.HttpServletRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/author/ai")
@RequiredArgsConstructor
@Tag(name = "Author AI", description = "AI outline and draft generation for approved Authors")
public class AuthorAiController {
    public static final String QUOTA_LIMIT = "X-AI-Quota-Limit";
    public static final String QUOTA_REMAINING = "X-AI-Quota-Remaining";

    /** Decoded draft request cap from the spec. */
    static final long MAX_DRAFT_BODY_BYTES = 16 * 1024;

    private final AuthorAiService service;
    private final AiDraftStreamService drafts;

    @PostMapping("/outlines")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Generate an article outline; does not save anything")
    public ResponseEntity<ApiResponse<AiOutlineResponse>> outline(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AiOutlineRequest request) {
        var result = service.outline(UUID.fromString(jwt.getSubject()), request);
        return ResponseEntity.ok()
                .header(QUOTA_LIMIT, String.valueOf(result.quota().limit()))
                .header(QUOTA_REMAINING, String.valueOf(result.quota().remaining()))
                .body(
                        ApiResponse.<AiOutlineResponse>builder()
                                .status(200)
                                .message("AI outline generated")
                                .data(result.body())
                                .build());
    }

    /**
     * Errors found before the emitter exists are plain HTTP errors; once the stream is open every
     * outcome is an SSE event and the status stays 200.
     */
    @PostMapping("/drafts:stream")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Stream an article draft as SSE; does not save anything")
    public ResponseEntity<SseEmitter> draft(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AiDraftRequest request,
            HttpServletRequest http)
            throws BindException {
        // shortcut: a chunked body has no Content-Length and is rejected too; browsers send one.
        long size = http.getContentLengthLong();
        if (size < 0 || size > MAX_DRAFT_BODY_BYTES) {
            var errors = new BeanPropertyBindingResult(request, "aiDraftRequest");
            errors.addError(new FieldError("aiDraftRequest", "body", "Request body must be at most 16 KiB"));
            throw new BindException(errors);
        }
        var generation = drafts.start(UUID.fromString(jwt.getSubject()), request);
        var emitter = new SseEmitter(generation.timeout().plus(AiDraftStreamService.EMITTER_GRACE).toMillis());
        drafts.stream(generation, emitter);
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_EVENT_STREAM, StandardCharsets.UTF_8))
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-transform")
                .header("X-Accel-Buffering", "no")
                .header(QUOTA_LIMIT, String.valueOf(generation.quota().limit()))
                .header(QUOTA_REMAINING, String.valueOf(generation.quota().remaining()))
                .body(emitter);
    }

    @DeleteMapping("/generations/{generationId}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Stop a running draft stream; idempotent")
    public ApiResponse<AiGenerationStatusResponse> cancel(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID generationId) {
        var result = drafts.cancel(UUID.fromString(jwt.getSubject()), generationId);
        return ApiResponse.<AiGenerationStatusResponse>builder()
                .status(200)
                .message("AI generation cancellation processed")
                .data(new AiGenerationStatusResponse(generationId, result.name()))
                .build();
    }

    /** Same envelope as GlobalExceptionHandler, plus the allowance left after the refund. */
    @ExceptionHandler(AuthorAiService.QuotaAwareException.class)
    ResponseEntity<ErrorResponse> quotaAwareFailure(
            AuthorAiService.QuotaAwareException e, HttpServletRequest request) {
        ErrorCode code = e.getErrorCode();
        return ResponseEntity.status(code.getStatus())
                .header(QUOTA_LIMIT, String.valueOf(e.getQuota().limit()))
                .header(QUOTA_REMAINING, String.valueOf(e.getQuota().remaining()))
                .body(
                        ErrorResponse.builder()
                                .status(code.getStatus().value())
                                .code(code.getCode())
                                .message(code.getMessage())
                                .error(code.getStatus().getReasonPhrase())
                                .timestamp(Instant.now())
                                .path(request.getRequestURI())
                                .build());
    }
}
