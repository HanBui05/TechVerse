package com.techverse.server.dto.response;

import com.techverse.server.entity.CourseOrder;
import com.techverse.server.entity.OrderItem;
import com.techverse.server.entity.PaymentTransaction;
import com.techverse.server.entity.User;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Admin view of an order for bank-statement matching: buyer, snapshot, flags and confirmed payments. */
public record AdminOrderResponse(
        String orderCode,
        UUID buyerId,
        String buyerName,
        String buyerEmail,
        UUID courseId,
        String courseTitle,
        long amount,
        String currency,
        CourseOrder.Status status,
        Instant createdAt,
        Instant expiresAt,
        Instant paidAt,
        Instant transferReportedAt,
        boolean needsReconciliation,
        Instant reconciledAt,
        List<Payment> payments) {

    /** One confirmed transfer; more than one means a duplicate payment to reconcile. */
    public record Payment(String reference, long amount, String source, Instant confirmedAt) {}

    public static AdminOrderResponse of(OrderItem item, User buyer, List<PaymentTransaction> payments) {
        CourseOrder o = item.getOrder();
        return new AdminOrderResponse(
                o.getOrderCode(),
                o.getUserId(),
                buyer == null ? null : buyer.getFullName(),
                buyer == null ? null : buyer.getEmail(),
                item.getCourseId(),
                item.getCourseTitleSnapshot(),
                o.getTotalAmount(),
                "VND",
                o.getStatus(),
                o.getCreatedAt(),
                o.getExpiresAt(),
                o.getPaidAt(),
                o.getTransferReportedAt(),
                o.isNeedsReconciliation(),
                o.getReconciledAt(),
                payments.stream()
                        .map(t -> new Payment(t.getProviderTransactionId(), t.getAmount(), t.getConfirmationSource(), t.getConfirmedAt()))
                        .toList());
    }
}
