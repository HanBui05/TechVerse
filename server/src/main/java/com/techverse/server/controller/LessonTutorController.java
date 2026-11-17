package com.techverse.server.controller;

import com.techverse.server.dto.request.LessonTutorRequest;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.service.impl.AiDraftStreamService;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.LessonTutorService;

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
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Lesson tutor", description = "Ask the AI about the lesson being read")
public class LessonTutorController {
    private final LessonTutorService tutor;

    /** Errors found before the emitter exists are plain HTTP errors; afterwards every outcome is an event. */
    @PostMapping("/courses/{courseId}/lessons/{lessonId}/tutor:stream")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Stream an AI answer about one lesson as SSE; stores nothing")
    public ResponseEntity<SseEmitter> ask(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID courseId,
            @PathVariable UUID lessonId,
            @Valid @RequestBody LessonTutorRequest request) {
        var generation = tutor.start(UUID.fromString(jwt.getSubject()), courseId, lessonId, request);
        var emitter = new SseEmitter(generation.timeout().plus(AiDraftStreamService.EMITTER_GRACE).toMillis());
        tutor.stream(generation, emitter);
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_EVENT_STREAM, StandardCharsets.UTF_8))
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-transform")
                .header("X-Accel-Buffering", "no")
                .header(AuthorAiController.QUOTA_LIMIT, String.valueOf(generation.quota().limit()))
                .header(AuthorAiController.QUOTA_REMAINING, String.valueOf(generation.quota().remaining()))
                .body(emitter);
    }

    @GetMapping("/me/ai-tutor/quota")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Today's AI tutor allowance; reserves nothing")
    public ApiResponse<Quota> quota(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.<Quota>builder()
                .status(200)
                .message("AI tutor quota retrieved")
                .data(tutor.quota(UUID.fromString(jwt.getSubject())))
                .build();
    }
}
