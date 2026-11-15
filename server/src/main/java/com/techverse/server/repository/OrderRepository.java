package com.techverse.server.repository;

import com.techverse.server.entity.CourseOrder;
import com.techverse.server.entity.OrderItem;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

/** Orders are inserted natively: triggers compute the revenue split and the order total. */
public interface OrderRepository extends JpaRepository<CourseOrder, UUID> {
    /**
     * Marks the user's overdue PENDING orders (and their pending transactions) EXPIRED; no scheduler.
     * {@code clock_timestamp()}, not {@code now()}: a request that waited for the user lock past the
     * deadline must see the order as expired.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "WITH expired AS (UPDATE orders SET status = 'EXPIRED' WHERE user_id = :userId AND status = 'PENDING'"
                    + " AND expires_at <= clock_timestamp() RETURNING id)"
                    + " UPDATE payment_transactions SET status = 'EXPIRED'"
                    + " WHERE status = 'PENDING' AND order_id IN (SELECT id FROM expired)",
            nativeQuery = true)
    int expireOverdue(@Param("userId") UUID userId);

    @Query(
            value = "SELECT id FROM commission_policies WHERE is_active AND effective_from <= now()"
                    + " AND (effective_to IS NULL OR effective_to > now())",
            nativeQuery = true)
    Optional<UUID> activeCommissionPolicyId();

    @Modifying
    @Query(
            value = "INSERT INTO orders (id, user_id, order_code, expires_at, created_by, updated_by)"
                    + " VALUES (:id, :userId, 'TV' || lpad(nextval('order_code_seq')::text, 12, '0'),"
                    + " now() + make_interval(hours => :hours), :userId, :userId)",
            nativeQuery = true)
    void insertOrder(@Param("id") UUID id, @Param("userId") UUID userId, @Param("hours") int hours);

    /** Commission columns are left to {@code calculate_order_item_revenue}, the total to {@code refresh_order_total}. */
    @Modifying
    @Query(
            value = "INSERT INTO order_items (order_id, course_id, course_title_snapshot, unit_price_amount,"
                    + " commission_policy_id, created_by, updated_by)"
                    + " VALUES (:orderId, :courseId, :title, :price, :policyId, :userId, :userId)",
            nativeQuery = true)
    void insertItem(
            @Param("orderId") UUID orderId,
            @Param("courseId") UUID courseId,
            @Param("title") String title,
            @Param("price") long price,
            @Param("policyId") UUID policyId,
            @Param("userId") UUID userId);

    /** Amount is read back from the trigger-maintained order total. */
    @Modifying
    @Query(
            value = "INSERT INTO payment_transactions (order_id, provider, amount, created_by, updated_by)"
                    + " SELECT id, 'MANUAL', total_amount, :userId, :userId FROM orders WHERE id = :orderId",
            nativeQuery = true)
    void insertManualTransaction(@Param("orderId") UUID orderId, @Param("userId") UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "UPDATE orders SET transfer_reported_at = COALESCE(transfer_reported_at, now()) WHERE id = :id",
            nativeQuery = true)
    void reportTransfer(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CourseOrder o where o.orderCode = :code and o.userId = :userId")
    Optional<CourseOrder> findOwnedForUpdate(@Param("code") String code, @Param("userId") UUID userId);

    @Query("select i from OrderItem i join fetch i.order o where o.orderCode = :code and o.userId = :userId")
    Optional<OrderItem> findOwnedItem(@Param("code") String code, @Param("userId") UUID userId);

    @Query("select i from OrderItem i join fetch i.order o where o.id = :orderId")
    Optional<OrderItem> findItem(@Param("orderId") UUID orderId);

    @Query(
            "select i from OrderItem i join fetch i.order o"
                    + " where o.userId = :userId and i.courseId = :courseId and o.status = :status")
    List<OrderItem> findByStatus(
            @Param("userId") UUID userId, @Param("courseId") UUID courseId, @Param("status") CourseOrder.Status status);

    @Query(
            value = "select i from OrderItem i join fetch i.order o where o.userId = :userId order by o.createdAt desc, o.id desc",
            countQuery = "select count(o) from CourseOrder o where o.userId = :userId")
    Page<OrderItem> findMine(@Param("userId") UUID userId, Pageable pageable);
}
