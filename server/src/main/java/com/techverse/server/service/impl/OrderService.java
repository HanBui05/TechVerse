package com.techverse.server.service.impl;

import com.techverse.server.dto.response.AdminOrderResponse;
import com.techverse.server.dto.response.AuthorRevenueResponse;
import com.techverse.server.dto.response.OrderResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.entity.*;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.CourseSpecification;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Course orders paid by manual bank transfer (VietQR); an Admin confirms them later. Lock order:
 * buyer's {@code users} row (serialises that buyer's requests), then the course row (shared, so a
 * concurrent price change finishes first), then the order.
 */
@Service
@RequiredArgsConstructor
public class OrderService {
    static final int MANUAL_HOURS = 24;
    private static final Pattern BANK_ID = Pattern.compile("[A-Za-z0-9]{2,20}");
    private static final Pattern ACCOUNT_NO = Pattern.compile("[0-9]{6,19}");
    private static final Pattern TEMPLATE = Pattern.compile("[A-Za-z0-9_]{1,30}");
    private static final DefaultRedisScript<Long> COUNTER = new DefaultRedisScript<>(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", Long.class);

    private final OrderRepository orders;
    private final CourseRepository courses;
    private final CourseEnrollmentRepository enrollments;
    private final UserRepository users;
    private final StringRedisTemplate redis;

    @Value("${vietqr.bank-id:}")
    private String bankId;

    @Value("${vietqr.account-no:}")
    private String accountNo;

    @Value("${vietqr.account-name:}")
    private String accountName;

    @Value("${vietqr.template:compact2}")
    private String template;

    @Value("${order.requests-per-minute:5}")
    private int requestsPerMinute;

    /** Returns the buyer's open order for the course, or creates one with today's price and policy. */
    @Transactional
    public OrderResponse create(UUID actor, UUID courseId) {
        checkRate(actor);
        User buyer = users.findByIdForAuthentication(actor)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        if (!buyer.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
        if (buyer.getUserRoles().stream().anyMatch(l -> l.getRole().getName() == RoleName.ADMIN
                || l.getRole().getName() == RoleName.MODERATOR))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
        courses.findByIdForShare(courseId).orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        Course course = courses.findOne(CourseSpecification.visibleCourse().and((root, q, cb) -> cb.equal(root.get("id"), courseId)))
                .orElseThrow(() -> new CustomException(ErrorCode.COURSE_NOT_FOUND));
        if (course.getAuthor().getId().equals(actor)) throw new CustomException(ErrorCode.ACCESS_DENIED);
        long price = course.getPriceAmount();
        if (price <= 0) throw new CustomException(ErrorCode.ORDER_COURSE_UNAVAILABLE);
        String title = course.getPublishedVersion().getTitle();
        if (enrollments.findActive(actor, courseId).isPresent()) throw new CustomException(ErrorCode.ORDER_ALREADY_ENROLLED);

        orders.expireOverdue(actor);
        var open = orders.findByStatus(actor, courseId, CourseOrder.Status.PENDING);
        if (!open.isEmpty()) return response(open.getFirst());

        // Never create an order nobody can pay.
        if (!qrConfigured()) throw new CustomException(ErrorCode.PAYMENT_UNAVAILABLE);
        UUID policy = orders.activeCommissionPolicyId().orElseThrow(() -> new CustomException(ErrorCode.PAYMENT_UNAVAILABLE));
        UUID id = UUID.randomUUID();
        orders.insertOrder(id, actor, MANUAL_HOURS);
        orders.insertItem(id, courseId, title, price, policy, actor);
        orders.insertManualTransaction(id, actor);
        return response(orders.findItem(id).orElseThrow());
    }

    @Transactional
    public OrderResponse detail(UUID actor, String code) {
        orders.expireOverdue(actor);
        return response(owned(actor, code));
    }

    @Transactional
    public PageResponse<OrderResponse> mine(UUID actor, int page, int size) {
        orders.expireOverdue(actor);
        var result = orders.findMine(actor, PageRequest.of(page, size));
        return PageResponse.from(result, result.stream().map(this::response).toList());
    }

    /** Buyer's "I have transferred": first time is kept; status and access never change here. */
    @Transactional
    public OrderResponse reportTransfer(UUID actor, String code) {
        checkRate(actor);
        orders.expireOverdue(actor);
        CourseOrder order = orders.findOwnedForUpdate(code, actor)
                .orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));
        // shortcut: every order is MANUAL while PayOS (1e) is deferred; check the provider when it lands.
        if (order.getStatus() != CourseOrder.Status.PENDING && order.getStatus() != CourseOrder.Status.EXPIRED)
            throw new CustomException(ErrorCode.ORDER_TRANSFER_REPORT_NOT_ALLOWED);
        orders.reportTransfer(order.getId());
        return response(owned(actor, code));
    }

    // ------------------------------------------------------------------ Admin confirmation

    /**
     * Records a bank transfer the Admin matched on the statement. Same lock order as {@link #create}: buyer
     * row first (serialises two orders of one learner), then the order. A reference already on this order
     * is a retry; on another order it is a conflict. A second real transfer on a PAID order is recorded and
     * the trigger flags reconciliation without a second enrollment or revenue item.
     */
    @Transactional
    public AdminOrderResponse confirm(UUID admin, String code, long amount, String reference) {
        CourseOrder order = lockOrder(code);
        // shortcut: every order is MANUAL while PayOS (1e) is deferred; a webhook path would skip this check.
        if (!orders.isManual(order.getId())) throw new CustomException(ErrorCode.PAYMENT_STATE_INVALID);
        var existing = orders.findManualPayment(reference);
        if (existing.isPresent()) {
            if (!existing.get().getOrderId().equals(order.getId())) throw new CustomException(ErrorCode.PAYMENT_REFERENCE_CONFLICT);
            if (existing.get().getAmount() != amount) throw new CustomException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
            return adminView(order.getId());
        }
        var status = order.getStatus();
        if (status != CourseOrder.Status.PENDING && status != CourseOrder.Status.EXPIRED && status != CourseOrder.Status.PAID)
            throw new CustomException(ErrorCode.PAYMENT_STATE_INVALID);
        if (amount != order.getTotalAmount()) throw new CustomException(ErrorCode.PAYMENT_AMOUNT_MISMATCH);
        try {
            if (status == CourseOrder.Status.PAID || orders.confirmOpenPayment(order.getId(), reference, admin) == 0)
                orders.insertPayment(order.getId(), reference, admin);
        } catch (DataIntegrityViolationException e) {
            // Same reference confirmed for another learner's order in a concurrent request.
            if (String.valueOf(e.getMessage()).contains("uq_payment_transactions_provider_reference"))
                throw new CustomException(ErrorCode.PAYMENT_REFERENCE_CONFLICT);
            throw e;
        }
        return adminView(order.getId());
    }

    /**
     * Closes the duplicate-payment flag for the payments the Admin reviewed ({@code paymentCount}); a retry
     * returns the closed order. If a new payment reopened the flag meanwhile, the count differs and the
     * flag stays open, so a delayed retry cannot hide an anomaly nobody has seen.
     */
    @Transactional
    public AdminOrderResponse reconcile(UUID admin, String code, int paymentCount) {
        CourseOrder order = lockOrder(code);
        if (order.isNeedsReconciliation()) {
            if (orders.findPayments(List.of(order.getId())).size() != paymentCount)
                throw new CustomException(ErrorCode.PAYMENT_RECONCILIATION_STALE);
            orders.reconcile(order.getId(), admin);
        } else if (order.getReconciledAt() == null) throw new CustomException(ErrorCode.PAYMENT_RECONCILIATION_NOT_REQUIRED);
        return adminView(order.getId());
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminOrderResponse> adminOrders(
            CourseOrder.Status status, String code, Boolean transferReported, Boolean needsReconciliation, int page, int size) {
        String normalized = code == null || code.isBlank() ? null : code.strip().toUpperCase(Locale.ROOT);
        var result = orders.findForAdmin(status, normalized, transferReported, needsReconciliation, PageRequest.of(page, size));
        var orderIds = result.stream().map(i -> i.getOrder().getId()).toList();
        var buyers = new HashMap<UUID, User>();
        users.findAllById(result.stream().map(i -> i.getOrder().getUserId()).collect(java.util.stream.Collectors.toSet()))
                .forEach(u -> buyers.put(u.getId(), u));
        var payments = new HashMap<UUID, List<PaymentTransaction>>();
        if (!orderIds.isEmpty())
            orders.findPayments(orderIds).forEach(t -> payments.computeIfAbsent(t.getOrderId(), k -> new ArrayList<>()).add(t));
        return PageResponse.from(result, result.stream().map(i -> AdminOrderResponse.of(
                i, buyers.get(i.getOrder().getUserId()), payments.getOrDefault(i.getOrder().getId(), List.of()))).toList());
    }

    @Transactional(readOnly = true)
    public AuthorRevenueResponse revenue(UUID author, int page, int size) {
        var t = orders.revenueTotals(author);
        var items = orders.findRevenue(author, PageRequest.of(page, size));
        return new AuthorRevenueResponse(
                new AuthorRevenueResponse.Totals(t.getItemCount(), t.getGrossAmount(), t.getPlatformAmount(), t.getAuthorAmount()),
                PageResponse.from(items, items.stream().map(AuthorRevenueResponse.Item::of).toList()));
    }

    // ------------------------------------------------------------------ helpers

    private CourseOrder lockOrder(String code) {
        UUID buyer = orders.findBuyer(code).orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));
        users.findByIdForAuthentication(buyer);
        return orders.findByCodeForUpdate(code).orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));
    }

    private AdminOrderResponse adminView(UUID orderId) {
        var item = orders.findItem(orderId).orElseThrow();
        return AdminOrderResponse.of(item, users.findById(item.getOrder().getUserId()).orElse(null), orders.findPayments(List.of(orderId)));
    }

    private OrderItem owned(UUID actor, String code) {
        return orders.findOwnedItem(code, actor).orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));
    }

    private OrderResponse response(OrderItem item) {
        var o = item.getOrder();
        boolean payable = o.getStatus() == CourseOrder.Status.PENDING || o.getStatus() == CourseOrder.Status.EXPIRED;
        return OrderResponse.of(item, payable ? vietQr(o.getTotalAmount(), o.getOrderCode()) : null);
    }

    /** VietQR quick-link image; the browser fetches it, the server never calls VietQR. */
    OrderResponse.VietQr vietQr(long amount, String code) {
        if (!qrConfigured()) return null;
        String url = "https://img.vietqr.io/image/" + bankId + "-" + accountNo + "-" + template + ".png"
                + "?amount=" + amount
                + "&addInfo=" + UriUtils.encodeQueryParam(code, StandardCharsets.UTF_8)
                + "&accountName=" + UriUtils.encodeQueryParam(accountName.strip(), StandardCharsets.UTF_8);
        return new OrderResponse.VietQr(bankId, accountNo, accountName.strip(), amount, code, url);
    }

    boolean qrConfigured() {
        return bankId != null && BANK_ID.matcher(bankId).matches()
                && accountNo != null && ACCOUNT_NO.matcher(accountNo).matches()
                && accountName != null && !accountName.isBlank()
                && template != null && TEMPLATE.matcher(template).matches();
    }

    /** Create and transfer-report share one budget per user, retries included. */
    void checkRate(UUID actor) {
        try {
            Long count = redis.execute(COUNTER, List.of("order:rate:" + actor));
            if (count == null) throw new CustomException(ErrorCode.PAYMENT_UNAVAILABLE);
            if (count > requestsPerMinute) throw new CustomException(ErrorCode.ORDER_RATE_LIMITED);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.PAYMENT_UNAVAILABLE);
        }
    }
}
