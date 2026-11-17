package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.util.UUID;

/** One course per order; commission columns are filled by trigger (snapshot of the policy at order time). */
@Entity
@Table(name = "order_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrderItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, insertable = false, updatable = false)
    private CourseOrder order;

    @Column(name = "course_id", nullable = false, insertable = false, updatable = false)
    private UUID courseId;

    @Column(name = "course_title_snapshot", nullable = false, insertable = false, updatable = false)
    private String courseTitleSnapshot;

    @Column(name = "unit_price_amount", nullable = false, insertable = false, updatable = false)
    private long unitPriceAmount;

    @Column(name = "commission_rate_bps", nullable = false, insertable = false, updatable = false)
    private int commissionRateBps;

    @Column(name = "commission_amount", nullable = false, insertable = false, updatable = false)
    private long commissionAmount;

    @Column(name = "author_net_amount", nullable = false, insertable = false, updatable = false)
    private long authorNetAmount;
}
