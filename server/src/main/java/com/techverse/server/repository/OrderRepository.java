package com.techverse.server.repository;

import com.techverse.server.entity.CourseOrder;
import com.techverse.server.entity.OrderItem;
import com.techverse.server.entity.PaymentTransaction;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

/** Orders are inserted natively: triggers compute the revenue split and the order total. */
public interface OrderRepository extends JpaRepository<CourseOrder, UUID> {
    /** Advisory lock key serialising commission policy changes with order item creation. */
    long COMMISSION_LOCK = 7_305_001L;

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

    /** Transaction-scoped: held to commit by both a policy change and an order item insert. */
    @Query(value = "SELECT count(*) FROM (SELECT pg_advisory_xact_lock(" + COMMISSION_LOCK + ")) l", nativeQuery = true)
    long lockCommission();

    /**
     * {@code clock_timestamp()}, not {@code now()}: after waiting for the commission lock, a policy that
     * took effect after this transaction started must count as active.
     */
    @Query(
            value = "SELECT id FROM commission_policies WHERE is_active AND effective_from <= clock_timestamp()"
                    + " AND (effective_to IS NULL OR effective_to > clock_timestamp())",
            nativeQuery = true)
    Optional<UUID> activeCommissionPolicyId();

    interface CommissionPolicyRow {
        UUID getId();
        Integer getRateBps();
        java.time.Instant getEffectiveFrom();
    }

    @Query(
            value = "SELECT id, rate_bps AS rateBps, effective_from AS effectiveFrom FROM commission_policies WHERE is_active",
            nativeQuery = true)
    Optional<CommissionPolicyRow> activeCommissionPolicy();

    @Query(value = "SELECT clock_timestamp()", nativeQuery = true)
    java.time.Instant clockTimestamp();

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "UPDATE commission_policies SET is_active = false, effective_to = :at, updated_by = :admin WHERE id = :id",
            nativeQuery = true)
    void closeCommissionPolicy(@Param("id") UUID id, @Param("at") java.time.Instant at, @Param("admin") UUID admin);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "INSERT INTO commission_policies (rate_bps, effective_from, is_active, created_by, updated_by)"
                    + " VALUES (:rate, :at, true, :admin, :admin)",
            nativeQuery = true)
    void insertCommissionPolicy(@Param("rate") int rate, @Param("at") java.time.Instant at, @Param("admin") UUID admin);

    /** {@code clock_timestamp()}: created after the commission lock, never before the policy it snapshots. */
    @Modifying
    @Query(
            value = "INSERT INTO orders (id, user_id, order_code, expires_at, created_at, created_by, updated_by)"
                    + " VALUES (:id, :userId, 'TV' || lpad(nextval('order_code_seq')::text, 12, '0'),"
                    + " clock_timestamp() + make_interval(hours => :hours), clock_timestamp(), :userId, :userId)",
            nativeQuery = true)
    void insertOrder(@Param("id") UUID id, @Param("userId") UUID userId, @Param("hours") int hours);

    /** Commission columns are left to {@code calculate_order_item_revenue}, the total to {@code refresh_order_total}. */
    @Modifying
    @Query(
            value = "INSERT INTO order_items (order_id, course_id, course_title_snapshot, unit_price_amount,"
                    + " commission_policy_id, created_at, created_by, updated_by)"
                    + " VALUES (:orderId, :courseId, :title, :price, :policyId, clock_timestamp(), :userId, :userId)",
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

    // ------------------------------------------------------------------ Admin confirmation

    /** Scalar on purpose: loading the entity before the lock would leave a stale instance in the context. */
    @Query("select o.userId from CourseOrder o where o.orderCode = :code")
    Optional<UUID> findBuyer(@Param("code") String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CourseOrder o where o.orderCode = :code")
    Optional<CourseOrder> findByCodeForUpdate(@Param("code") String code);

    @Query("select t from PaymentTransaction t where t.provider = 'MANUAL' and t.providerTransactionId = :reference")
    Optional<PaymentTransaction> findManualPayment(@Param("reference") String reference);

    @Query("select count(t) > 0 from PaymentTransaction t where t.orderId = :orderId and t.provider = 'MANUAL'")
    boolean isManual(@Param("orderId") UUID orderId);

    /** First payment: the order's open MANUAL row turns SUCCEEDED; the grant trigger pays the order. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "UPDATE payment_transactions SET status = 'SUCCEEDED', provider_transaction_id = :reference,"
                    + " paid_at = now(), confirmed_by = :admin, confirmation_source = 'ADMIN', confirmed_at = now(), updated_by = :admin"
                    + " WHERE id = (SELECT id FROM payment_transactions WHERE order_id = :orderId AND provider = 'MANUAL'"
                    + " AND status IN ('PENDING', 'EXPIRED') ORDER BY created_at LIMIT 1)",
            nativeQuery = true)
    int confirmOpenPayment(@Param("orderId") UUID orderId, @Param("reference") String reference, @Param("admin") UUID admin);

    /** Another real transfer for an order that already has one: recorded, the trigger flags reconciliation. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "INSERT INTO payment_transactions (order_id, provider, provider_transaction_id, amount, status, paid_at,"
                    + " confirmed_by, confirmation_source, confirmed_at, created_by, updated_by)"
                    + " SELECT id, 'MANUAL', :reference, total_amount, 'SUCCEEDED', now(), :admin, 'ADMIN', now(), :admin, :admin"
                    + " FROM orders WHERE id = :orderId",
            nativeQuery = true)
    int insertPayment(@Param("orderId") UUID orderId, @Param("reference") String reference, @Param("admin") UUID admin);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "UPDATE orders SET needs_reconciliation = false, reconciled_by = :admin, reconciled_at = now(),"
                    + " updated_by = :admin WHERE id = :orderId",
            nativeQuery = true)
    void reconcile(@Param("orderId") UUID orderId, @Param("admin") UUID admin);

    @Query(
            value = "select i from OrderItem i join fetch i.order o where (:status is null or o.status = :status)"
                    + " and (:code is null or o.orderCode = :code)"
                    + " and (:reported is null or (:reported = true and o.transferReportedAt is not null)"
                    + " or (:reported = false and o.transferReportedAt is null))"
                    + " and (:flag is null or o.needsReconciliation = :flag)"
                    + " order by o.createdAt desc, o.id desc",
            countQuery = "select count(o) from CourseOrder o where (:status is null or o.status = :status)"
                    + " and (:code is null or o.orderCode = :code)"
                    + " and (:reported is null or (:reported = true and o.transferReportedAt is not null)"
                    + " or (:reported = false and o.transferReportedAt is null))"
                    + " and (:flag is null or o.needsReconciliation = :flag)")
    Page<OrderItem> findForAdmin(
            @Param("status") CourseOrder.Status status,
            @Param("code") String code,
            @Param("reported") Boolean reported,
            @Param("flag") Boolean flag,
            Pageable pageable);

    @Query("select t from PaymentTransaction t where t.orderId in :orderIds and t.status = 'SUCCEEDED'"
            + " order by t.confirmedAt, t.createdAt")
    List<PaymentTransaction> findPayments(@Param("orderIds") Collection<UUID> orderIds);

    // ------------------------------------------------------------------ Author revenue (snapshots of PAID items)

    @Query(
            value = "select i from OrderItem i join fetch i.order o where o.status = 'PAID'"
                    + " and i.courseId in (select c.id from Course c where c.author.id = :authorId)"
                    + " order by o.paidAt desc, o.id desc",
            countQuery = "select count(i) from OrderItem i join i.order o where o.status = 'PAID'"
                    + " and i.courseId in (select c.id from Course c where c.author.id = :authorId)")
    Page<OrderItem> findRevenue(@Param("authorId") UUID authorId, Pageable pageable);

    interface RevenueTotals {
        Long getItemCount();
        Long getGrossAmount();
        Long getPlatformAmount();
        Long getAuthorAmount();
        Long getPaidOutAmount();
    }

    /** Earned and paid out in one statement, so the balance never mixes two snapshots. */
    @Query(
            value = "SELECT count(i.id) AS itemCount, coalesce(sum(i.unit_price_amount), 0)::bigint AS grossAmount,"
                    + " coalesce(sum(i.commission_amount), 0)::bigint AS platformAmount,"
                    + " coalesce(sum(i.author_net_amount), 0)::bigint AS authorAmount,"
                    + " (SELECT coalesce(sum(p.amount), 0) FROM author_payouts p WHERE p.author_id = :authorId)::bigint AS paidOutAmount"
                    + " FROM order_items i JOIN orders o ON o.id = i.order_id JOIN courses c ON c.id = i.course_id"
                    + " WHERE o.status = 'PAID' AND c.author_id = :authorId",
            nativeQuery = true)
    RevenueTotals revenueTotals(@Param("authorId") UUID authorId);

    // ------------------------------------------------------------------ author payouts

    interface PayoutAccountRow {
        String getBankId();
        String getAccountNo();
        String getAccountName();
        java.time.Instant getUpdatedAt();
    }

    @Query(
            value = "SELECT bank_id AS bankId, account_no AS accountNo, account_name AS accountName, updated_at AS updatedAt"
                    + " FROM author_payout_accounts WHERE user_id = :userId",
            nativeQuery = true)
    Optional<PayoutAccountRow> findPayoutAccount(@Param("userId") UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "INSERT INTO author_payout_accounts (user_id, bank_id, account_no, account_name)"
                    + " VALUES (:userId, :bankId, :accountNo, :accountName)"
                    + " ON CONFLICT (user_id) DO UPDATE SET bank_id = EXCLUDED.bank_id,"
                    + " account_no = EXCLUDED.account_no, account_name = EXCLUDED.account_name",
            nativeQuery = true)
    void upsertPayoutAccount(
            @Param("userId") UUID userId,
            @Param("bankId") String bankId,
            @Param("accountNo") String accountNo,
            @Param("accountName") String accountName);

    interface PayoutRow {
        Long getAmount();
        String getBankReference();
        String getAccountNo();
        java.time.Instant getCreatedAt();
    }

    @Query(
            value = "SELECT amount, bank_reference AS bankReference, account_no AS accountNo, created_at AS createdAt"
                    + " FROM author_payouts WHERE author_id = :authorId ORDER BY created_at DESC, id DESC",
            countQuery = "SELECT count(*) FROM author_payouts WHERE author_id = :authorId",
            nativeQuery = true)
    Page<PayoutRow> findPayouts(@Param("authorId") UUID authorId, Pageable pageable);

    // ------------------------------------------------------------------ Admin payouts

    interface AuthorBalanceRow {
        UUID getAuthorId();
        String getFullName();
        String getEmail();
        Long getEarnedAmount();
        Long getPaidOutAmount();
        Long getBalanceAmount();
        String getBankId();
        String getAccountNo();
        String getAccountName();
        java.time.Instant getUpdatedAt();
    }

    /** Every author with PAID revenue; same earned formula as {@link #revenueTotals}, largest balance first. */
    String AUTHOR_BALANCES = " FROM (SELECT e.author_id, e.earned,"
            + " (SELECT coalesce(sum(p.amount), 0) FROM author_payouts p WHERE p.author_id = e.author_id)::bigint AS paid"
            + " FROM (SELECT c.author_id, sum(i.author_net_amount)::bigint AS earned FROM order_items i"
            + " JOIN orders o ON o.id = i.order_id JOIN courses c ON c.id = i.course_id"
            + " WHERE o.status = 'PAID' GROUP BY c.author_id) e) b"
            + " JOIN users u ON u.id = b.author_id LEFT JOIN author_payout_accounts a ON a.user_id = b.author_id"
            + " WHERE (:owedOnly = false OR b.earned > b.paid)";

    @Query(
            value = "SELECT b.author_id AS authorId, u.full_name AS fullName, u.email::text AS email, b.earned AS earnedAmount,"
                    + " b.paid AS paidOutAmount, b.earned - b.paid AS balanceAmount, a.bank_id AS bankId,"
                    + " a.account_no AS accountNo, a.account_name AS accountName, a.updated_at AS updatedAt"
                    + AUTHOR_BALANCES + " ORDER BY b.earned - b.paid DESC, b.author_id",
            countQuery = "SELECT count(*)" + AUTHOR_BALANCES,
            nativeQuery = true)
    Page<AuthorBalanceRow> findAuthorBalances(@Param("owedOnly") boolean owedOnly, Pageable pageable);

    interface AdminPayoutRow {
        UUID getId();
        UUID getAuthorId();
        String getAuthorName();
        Long getAmount();
        String getBankReference();
        String getBankId();
        String getAccountNo();
        String getAccountName();
        UUID getRecordedById();
        String getRecordedByName();
        java.time.Instant getCreatedAt();
    }

    String ADMIN_PAYOUT = "SELECT p.id, p.author_id AS authorId, au.full_name AS authorName, p.amount,"
            + " p.bank_reference AS bankReference, p.bank_id AS bankId, p.account_no AS accountNo,"
            + " p.account_name AS accountName, p.created_by AS recordedById, ad.full_name AS recordedByName,"
            + " p.created_at AS createdAt"
            + " FROM author_payouts p JOIN users au ON au.id = p.author_id JOIN users ad ON ad.id = p.created_by";

    @Query(value = ADMIN_PAYOUT + " WHERE p.bank_reference = :reference", nativeQuery = true)
    Optional<AdminPayoutRow> findPayoutByReference(@Param("reference") String reference);

    @Query(
            value = ADMIN_PAYOUT + " WHERE (CAST(:authorId AS uuid) IS NULL OR p.author_id = CAST(:authorId AS uuid))"
                    + " ORDER BY p.created_at DESC, p.id DESC",
            countQuery = "SELECT count(*) FROM author_payouts p"
                    + " WHERE (CAST(:authorId AS uuid) IS NULL OR p.author_id = CAST(:authorId AS uuid))",
            nativeQuery = true)
    Page<AdminPayoutRow> findAdminPayouts(@Param("authorId") UUID authorId, Pageable pageable);

    /** 0 rows: the reference was taken meanwhile; never a unique violation that would poison the transaction. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
            value = "INSERT INTO author_payouts (author_id, amount, bank_reference, bank_id, account_no, account_name, created_by)"
                    + " VALUES (:authorId, :amount, :reference, :bankId, :accountNo, :accountName, :admin)"
                    + " ON CONFLICT (bank_reference) DO NOTHING",
            nativeQuery = true)
    int insertPayout(
            @Param("authorId") UUID authorId,
            @Param("amount") long amount,
            @Param("reference") String reference,
            @Param("bankId") String bankId,
            @Param("accountNo") String accountNo,
            @Param("accountName") String accountName,
            @Param("admin") UUID admin);
}
