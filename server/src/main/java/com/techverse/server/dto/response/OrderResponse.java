package com.techverse.server.dto.response;

import com.techverse.server.entity.CourseOrder;
import com.techverse.server.entity.OrderItem;

import java.time.Instant;
import java.util.UUID;

/**
 * The buyer's view of an order: snapshots, state, deadline and the VietQR transfer details
 * ({@code vietQr} only while PENDING/EXPIRED and when the receiving account is configured).
 */
public record OrderResponse(
        String orderCode,
        UUID courseId,
        String courseTitle,
        long amount,
        String currency,
        CourseOrder.Status status,
        Instant createdAt,
        Instant expiresAt,
        Instant paidAt,
        Instant transferReportedAt,
        VietQr vietQr) {

    /** Transfer parameters; {@code content} is the order code the Admin matches on the bank statement. */
    public record VietQr(String bankId, String accountNo, String accountName, long amount, String content, String imageUrl) {}

    public static OrderResponse of(OrderItem item, VietQr vietQr) {
        CourseOrder o = item.getOrder();
        return new OrderResponse(
                o.getOrderCode(),
                item.getCourseId(),
                item.getCourseTitleSnapshot(),
                o.getTotalAmount(),
                "VND",
                o.getStatus(),
                o.getCreatedAt(),
                o.getExpiresAt(),
                o.getPaidAt(),
                o.getTransferReportedAt(),
                vietQr);
    }
}
