package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Read model of {@code orders}: rows are written by native SQL in {@code OrderRepository} because the
 * DB triggers own the total and the revenue split. Currency is always VND and stays unmapped.
 */
@Entity
@Table(name = "orders")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CourseOrder extends BaseEntity {
    public enum Status { PENDING, PAID, FAILED, CANCELLED, EXPIRED }

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "order_code", nullable = false, length = 50, updatable = false)
    private String orderCode;

    @Column(name = "total_amount", nullable = false, insertable = false, updatable = false)
    private long totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, insertable = false, updatable = false)
    private Status status;

    @Column(name = "paid_at", insertable = false, updatable = false)
    private Instant paidAt;

    @Column(name = "expires_at", insertable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "transfer_reported_at", insertable = false, updatable = false)
    private Instant transferReportedAt;
}
