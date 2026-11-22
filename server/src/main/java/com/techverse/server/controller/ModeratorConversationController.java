package com.techverse.server.controller;

import com.techverse.server.dto.request.ConversationRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ConversationResponse.Messages;
import com.techverse.server.dto.response.ReportResponse.ModeratedConversation;
import com.techverse.server.service.impl.ConversationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/moderator/conversations")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MODERATOR')")
@Tag(name = "Moderator Conversations", description = "Read-only access and locking for conversations that were reported")
public class ModeratorConversationController {
    private final ConversationService service;

    @GetMapping
    @Operation(summary = "Locked conversations (locked=true required), most recently locked first; no message content")
    public ApiResponse<PageResponse<ModeratedConversation>> locked(@AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject @ModelAttribute ConversationRequest.Locked filter) {
        return ok("Locked conversations retrieved", service.locked(actor(jwt), filter.getPage(), filter.getSize()));
    }

    @GetMapping("/{id}/messages")
    @Operation(summary = "Messages of a reported conversation, paged like the participants' API; moves no read marker")
    public ApiResponse<Messages> messages(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @ParameterObject @ModelAttribute ConversationRequest.Messages filter) {
        return ok("Messages retrieved", service.moderatorMessages(actor(jwt), id, filter.getBeforeSeq(), filter.getAfterSeq(), filter.getSize()));
    }

    @PatchMapping("/{id}/lock")
    @Operation(summary = "Lock (note required, closes open reports) or unlock a conversation that was reported")
    public ApiResponse<ModeratedConversation> lock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody ConversationRequest.Lock request) {
        return ok("Conversation lock updated", service.lock(actor(jwt), id, request.locked(), request.note()));
    }

    private static UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
