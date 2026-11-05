package com.techverse.server.controller;

import com.techverse.server.dto.request.AiOutlineRequest;
import com.techverse.server.dto.response.AiOutlineResponse;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.exception.ErrorResponse;
import com.techverse.server.service.AuthorAiService;

import jakarta.servlet.http.HttpServletRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/author/ai")
@RequiredArgsConstructor
@Tag(name = "Author AI", description = "AI outline and draft generation for approved Authors")
public class AuthorAiController {
    public static final String QUOTA_LIMIT = "X-AI-Quota-Limit";
    public static final String QUOTA_REMAINING = "X-AI-Quota-Remaining";

    private final AuthorAiService service;

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
