package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Read model of {@code payment_transactions}; rows are written natively in {@code OrderRepository} so the
 * payment triggers (amount check, PAID + access) run in the same statement. Currency stays unmapped.
 */
@Entity
@Table(name = "payment_transactions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PaymentTransaction extends BaseEntity {
    @Column(name = "order_id", nullable = false, insertable = false, updatable = false)
    private UUID orderId;

    @Column(nullable = false, length = 30, insertable = false, updatable = false)
    private String provider;

    @Column(name = "provider_transaction_id", insertable = false, updatable = false)
    private String providerTransactionId;

    @Column(nullable = false, insertable = false, updatable = false)
    private long amount;

    @Column(nullable = false, length = 20, insertable = false, updatable = false)
    private String status;

    @Column(name = "confirmed_at", insertable = false, updatable = false)
    private Instant confirmedAt;

    @Column(name = "confirmation_source", length = 20, insertable = false, updatable = false)
    private String confirmationSource;
}
