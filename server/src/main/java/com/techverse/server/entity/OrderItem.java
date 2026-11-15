package com.techverse.server.entity;

import jakarta.persistence.*;

import lombok.*;

import java.util.UUID;

/** One course per order; commission columns are filled by trigger and mapped when revenue needs them. */
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
}
