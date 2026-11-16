package com.techverse.server.controller;

import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.OrderService;
import com.techverse.server.service.impl.PayosClient;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.servlet.http.HttpServletRequest;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.*;

import java.io.IOException;

/** The only public payment route: payOS calls it without a token; the signature is checked before anything else. */
@RestController
@RequiredArgsConstructor
@Tag(name = "Orders")
public class PayosWebhookController {
    static final int MAX_BODY = 16 * 1024;

    private final PayosClient payos;
    private final OrderService service;

    @PostMapping("/api/v1/payments/payos/webhook")
    @Operation(summary = "payOS webhook: a signal to look the order up on payOS; webhook data never pays an order")
    public ApiResponse<Void> webhook(HttpServletRequest request) throws IOException {
        // Read at most one byte past the limit, so a huge body is never buffered.
        if (request.getContentLengthLong() > MAX_BODY) throw new CustomException(ErrorCode.PAYMENT_WEBHOOK_INVALID);
        byte[] body = request.getInputStream().readNBytes(MAX_BODY + 1);
        if (body.length > MAX_BODY) throw new CustomException(ErrorCode.PAYMENT_WEBHOOK_INVALID);
        var orderNo = payos.webhookOrderNo(body);
        if (orderNo.isEmpty()) throw new CustomException(ErrorCode.PAYMENT_WEBHOOK_INVALID);
        service.webhook(orderNo.getAsLong());
        return ApiResponse.<Void>builder().status(200).message("Webhook received").build();
    }
}
