package com.techverse.server.controller;

import com.techverse.server.dto.request.ConversationRequest;
import com.techverse.server.dto.response.*;
import com.techverse.server.dto.response.ConversationResponse.*;
import com.techverse.server.service.impl.ConversationService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/conversations")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
@Tag(name = "Conversations", description = "Private messages between a learner and a course author")
public class ConversationController {
    private final ConversationService service;

    @PostMapping
    @Operation(summary = "Open (or reopen) the conversation with the author of a public course; no purchase needed")
    public ApiResponse<Detail> open(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ConversationRequest.Open request) {
        return ok("Conversation opened", service.open(actor(jwt), request.course()));
    }

    @GetMapping
    @Operation(summary = "My conversations in both roles, latest message first")
    public ApiResponse<PageResponse<Summary>> list(@AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ConversationRequest.Page page) {
        return ok("Conversations retrieved", service.list(actor(jwt), page.getPage(), page.getSize()));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "How many conversations have an unread message")
    public ApiResponse<UnreadCount> unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return ok("Unread count retrieved", service.unreadCount(actor(jwt)));
    }

    @PostMapping("/socket-ticket")
    @Operation(summary = "One-use ticket (30 s) for the event socket /ws/messaging?ticket=…; bound to this login session and token expiry")
    public ApiResponse<SocketTicket> socketTicket(@AuthenticationPrincipal Jwt jwt) {
        return ok("Socket ticket issued", service.socketTicket(actor(jwt), jwt.getClaimAsString("sid"), jwt.getExpiresAt()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "One conversation with what I may do in it")
    public ApiResponse<Detail> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Conversation retrieved", service.detail(actor(jwt), id));
    }

    @GetMapping("/{id}/messages")
    @Operation(summary = "Messages in ascending seq: latest page, before a seq, or the earliest after a seq")
    public ApiResponse<Messages> messages(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @ParameterObject @ModelAttribute ConversationRequest.Messages filter) {
        return ok("Messages retrieved", service.messages(actor(jwt), id, filter.getBeforeSeq(), filter.getAfterSeq(), filter.getSize()));
    }

    @PostMapping("/{id}/messages")
    @Operation(summary = "Send a message (201); the same clientId again returns the stored message (200)")
    public ResponseEntity<ApiResponse<ConversationResponse.Message>> send(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody ConversationRequest.Send request) {
        var sent = service.send(actor(jwt), id, request.content(), request.client());
        var status = sent.created() ? HttpStatus.CREATED : HttpStatus.OK;
        return ResponseEntity.status(status).body(ApiResponse.<ConversationResponse.Message>builder()
                .status(status.value()).message(sent.created() ? "Message sent" : "Message already sent").data(sent.message()).build());
    }

    @PutMapping("/{id}/read")
    @Operation(summary = "Move my read marker forward (never back, capped at the last message)")
    public ApiResponse<Detail> read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ConversationRequest.Read request) {
        return ok("Read marker updated", service.markRead(actor(jwt), id, request.seq()));
    }

    @PutMapping("/{id}/block")
    @Operation(summary = "Block (true) or unblock (false) for both sides; only the blocker can unblock")
    public ApiResponse<Detail> block(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody ConversationRequest.Block request) {
        return ok("Block updated", service.block(actor(jwt), id, request.blocked()));
    }

    private static UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
