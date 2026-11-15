package com.techverse.server.controller;

import com.techverse.server.dto.request.ArticleFilter;
import com.techverse.server.dto.response.*;
import com.techverse.server.entity.CourseOrder;
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

    @GetMapping("/admin/orders")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: orders newest first, filtered by status, exact order code, transfer report and reconciliation flag")
    public ApiResponse<PageResponse<AdminOrderResponse>> adminOrders(
            @RequestParam(required = false) CourseOrder.Status status,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) Boolean transferReported,
            @RequestParam(required = false) Boolean needsReconciliation,
            @Valid @ParameterObject @ModelAttribute ArticleFilter filter) {
        return ok("Orders retrieved",
                service.adminOrders(status, code, transferReported, needsReconciliation, filter.getPage(), filter.getSize()));
    }

    @PostMapping("/admin/orders/{orderCode}/confirm")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: body {amount, bankReference} from the bank statement; retry-safe; a new reference on a PAID order flags reconciliation")
    public ApiResponse<AdminOrderResponse> confirm(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String orderCode, @RequestBody(required = false) Map<String, Object> body) {
        if (body == null || body.size() != 2
                || !(body.get("amount") instanceof Integer || body.get("amount") instanceof Long)
                || ((Number) body.get("amount")).longValue() <= 0
                || !(body.get("bankReference") instanceof String reference)
                || reference.strip().isEmpty() || reference.strip().length() > 255)
            throw new CustomException(ErrorCode.PAYMENT_INVALID);
        return ok("Payment confirmed",
                service.confirm(actor(jwt), orderCode, ((Number) body.get("amount")).longValue(), reference.strip()));
    }

    @PostMapping("/admin/orders/{orderCode}/reconcile")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: body {paymentCount} = confirmed payments reviewed; closes the duplicate-payment flag (idempotent)")
    public ApiResponse<AdminOrderResponse> reconcile(
            @AuthenticationPrincipal Jwt jwt, @PathVariable String orderCode, @RequestBody(required = false) Map<String, Object> body) {
        if (body == null || body.size() != 1 || !(body.get("paymentCount") instanceof Integer count) || count < 1)
            throw new CustomException(ErrorCode.PAYMENT_INVALID);
        return ok("Order reconciled", service.reconcile(actor(jwt), orderCode, count));
    }

    @GetMapping("/admin/commission-policy")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: active commission policy (null when none is set)")
    public ApiResponse<CommissionPolicyResponse> commissionPolicy() {
        return ok("Commission policy retrieved", service.commissionPolicy());
    }

    @PutMapping("/admin/commission-policy")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Admin: body {rateBps} 0–10000; effective at once for new orders, old orders keep their snapshot")
    public ApiResponse<CommissionPolicyResponse> changeCommission(
            @AuthenticationPrincipal Jwt jwt, @RequestBody(required = false) Map<String, Object> body) {
        // Integer only: "1500", 15.5 and out-of-int numbers are rejected; no effective date from the client.
        if (body == null || body.size() != 1 || !(body.get("rateBps") instanceof Integer rate) || rate < 0 || rate > 10_000)
            throw new CustomException(ErrorCode.COMMISSION_RATE_INVALID);
        var change = service.changeCommission(actor(jwt), rate);
        return ok(change.changed() ? "Commission rate updated" : "Commission rate unchanged", change.policy());
    }

    @GetMapping("/author/revenue")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Author: totals and PAID items of own courses (order-time snapshot, no buyer data), newest first")
    public ApiResponse<AuthorRevenueResponse> revenue(
            @AuthenticationPrincipal Jwt jwt, @Valid @ParameterObject @ModelAttribute ArticleFilter filter) {
        return ok("Revenue retrieved", service.revenue(actor(jwt), filter.getPage(), filter.getSize()));
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
