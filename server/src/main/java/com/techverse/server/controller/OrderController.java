package com.techverse.server.controller;

import com.techverse.server.dto.request.ArticleFilter;
import com.techverse.server.dto.response.*;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.OrderService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@Tag(name = "Orders", description = "Buy a paid course by bank transfer (VietQR); an Admin confirms the payment")
public class OrderController {
    private final OrderService service;

    @PostMapping("/orders")
    @Operation(summary = "Body {courseId} only: returns the open order for this course or creates one (price set by the server)")
    public ApiResponse<OrderResponse> create(@AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) Map<String, Object> body) {
        return ok("Order ready", service.create(actor(jwt), courseId(body)));
    }

    @GetMapping("/orders/{orderCode}")
    @Operation(summary = "Own order with VietQR transfer details while pending or expired")
    public ApiResponse<OrderResponse> detail(@AuthenticationPrincipal Jwt jwt, @PathVariable String orderCode) {
        return ok("Order retrieved", service.detail(actor(jwt), orderCode));
    }

    @GetMapping("/me/orders")
    @Operation(summary = "Own orders, newest first; only page/size apply")
    public ApiResponse<PageResponse<OrderResponse>> mine(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ArticleFilter filter) {
        return ok("Orders retrieved", service.mine(actor(jwt), filter.getPage(), filter.getSize()));
    }

    @PostMapping("/orders/{orderCode}/transfer-report")
    @Operation(summary = "Tell the Admin you have transferred (idempotent); does not grant access")
    public ApiResponse<OrderResponse> reportTransfer(@AuthenticationPrincipal Jwt jwt, @PathVariable String orderCode) {
        return ok("Transfer reported", service.reportTransfer(actor(jwt), orderCode));
    }

    /** Exactly one field: price and total always come from the server. */
    private static UUID courseId(Map<String, Object> body) {
        if (body == null || body.size() != 1 || !(body.get("courseId") instanceof String id))
            throw new CustomException(ErrorCode.ORDER_INVALID);
        try {
            UUID parsed = UUID.fromString(id);
            // UUID.fromString also accepts short forms such as "1-1-1-1-1".
            if (parsed.toString().equalsIgnoreCase(id)) return parsed;
        } catch (IllegalArgumentException e) {
        }
        throw new CustomException(ErrorCode.ORDER_INVALID);
    }

    private static UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
