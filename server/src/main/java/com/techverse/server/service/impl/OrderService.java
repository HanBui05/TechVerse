package com.techverse.server.service.impl;

import com.techverse.server.dto.response.AdminOrderResponse;
import com.techverse.server.dto.response.AdminPayoutResponse;
import com.techverse.server.dto.response.AdminRevenueResponse;
import com.techverse.server.dto.response.AuthorRevenueResponse;
import com.techverse.server.dto.response.CommissionPolicyResponse;
import com.techverse.server.dto.response.OrderResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.dto.response.PayoutResponse;
import com.techverse.server.entity.*;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.repository.specification.CourseSpecification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Course orders paid by manual bank transfer (VietQR); an Admin confirms them later. Lock order:
 * buyer's {@code users} row (serialises that buyer's requests), then the course row (shared, so a
 * concurrent price change finishes first), then the order.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {
    static final int MANUAL_HOURS = 24;
    static final int PAYOS_MINUTES = 15;
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
    private final PayosClient payos;
    private final PlatformTransactionManager transactionManager;

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

    /**
     * Returns the buyer's open order for the course, or creates one with today's price and policy. The
     * order commits first; a payOS link is asked for afterwards, outside every transaction and lock.
     */
    public OrderResponse create(UUID actor, UUID courseId) {
        checkRate(actor);
        return withPayosLink(tx().execute(s -> openOrder(actor, courseId)));
    }

    private OrderItem openOrder(UUID actor, UUID courseId) {
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
        if (!open.isEmpty()) return open.getFirst();

        // Never create an order nobody can pay. payOS on: every new order is PAYOS; off: manual VietQR.
        boolean payosOn = payos.enabled();
        if (!payosOn && !qrConfigured()) throw new CustomException(ErrorCode.PAYMENT_UNAVAILABLE);
        orders.lockCommission();
        UUID policy =orders.activeCommissionPolicyId().orElseThrow(() -> new CustomException(ErrorCode.PAYMENT_UNAVAILABLE));
        UUID id = UUID.randomUUID();
        orders.insertOrder(id, actor, payosOn ? PAYOS_MINUTES : MANUAL_HOURS * 60);
        orders.insertItem(id, courseId, title, price, policy, actor);
        orders.insertTransaction(id, payosOn ? "PAYOS" : "MANUAL", actor);
        return orders.findItem(id).orElseThrow();
    }

    /**
     * "Ensure link" for a PENDING payOS order without one: (1) claim in a short transaction, (2) ask payOS
     * with no transaction open, (3) store the link only if none is stored and no other order holds it.
     * payOS failing leaves the order without a link; a read after 60 seconds tries again. The response is
     * always rebuilt from the order as it is now (a webhook may have paid it meanwhile).
     */
    private OrderResponse withPayosLink(OrderItem item) {
        var o = item.getOrder();
        if (!o.isPayos() || o.getStatus() != CourseOrder.Status.PENDING || o.getPayosPaymentLinkId() != null) return response(item);
        UUID orderId = o.getId();
        if (tx().execute(s -> orders.claimPayosLink(orderId)) == 0) return response(item);
        try {
            String link = payos.link(o.getOrderCode(), o.getTotalAmount(), o.getExpiresAt());
            Integer saved;
            try {
                saved = tx().execute(s -> orders.savePayosLink(orderId, link));
            } catch (DataIntegrityViolationException e) {
                saved = 0; // another order stored the same link id at the same moment
            }
            if (saved == 0) log.warn("payOS link for order {} not stored: the order or another order already holds a link", o.getOrderCode());
        } catch (PayosClient.PayosException e) {
            log.warn("payOS link for order {} not created: {}", o.getOrderCode(), e.getMessage());
        }
        return response(tx().execute(s -> orders.findItem(orderId).orElseThrow()));
    }

    private TransactionTemplate tx() {
        return new TransactionTemplate(transactionManager);
    }

    /** The active commission policy, or null when none is set (orders are then unavailable). */
    @Transactional(readOnly = true)
    public CommissionPolicyResponse commissionPolicy() {
        return orders.activeCommissionPolicy().map(OrderService::policyView).orElse(null);
    }

    public record CommissionChange(CommissionPolicyResponse policy, boolean changed) {}

    /**
     * Effective at once: closes the active policy and opens a new one at the same instant, under the
     * lock order creation takes, so every item snapshots exactly one policy. Same rate: no new row.
     */
    @Transactional
    public CommissionChange changeCommission(UUID admin, int rateBps) {
        orders.lockCommission();
        var current = orders.activeCommissionPolicy();
        if (current.isPresent() && current.get().getRateBps() == rateBps)
            return new CommissionChange(policyView(current.get()), false);
        // Read after the lock: later than the closed policy's effective_from, so the range check holds.
        var at = orders.clockTimestamp();
        current.ifPresent(p -> orders.closeCommissionPolicy(p.getId(), at, admin));
        orders.insertCommissionPolicy(rateBps, at, admin);
        return new CommissionChange(policyView(orders.activeCommissionPolicy().orElseThrow()), true);
    }

    private static CommissionPolicyResponse policyView(OrderRepository.CommissionPolicyRow p) {
        return new CommissionPolicyResponse(p.getId(), p.getRateBps(), p.getEffectiveFrom());
    }

    public OrderResponse detail(UUID actor, String code) {
        return withPayosLink(tx().execute(s -> {
            orders.expireOverdue(actor);
            return owned(actor, code);
        }));
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
        // payOS orders are confirmed by looking them up on payOS, never by the buyer's report.
        if (!orders.isManual(order.getId())
                || order.getStatus() != CourseOrder.Status.PENDING && order.getStatus() != CourseOrder.Status.EXPIRED)
            throw new CustomException(ErrorCode.ORDER_TRANSFER_REPORT_NOT_ALLOWED);
        orders.reportTransfer(order.getId());
        return response(owned(actor, code));
    }

    // ------------------------------------------------------------------ payOS confirmation

    static final int SYNC_PER_MINUTE = 10;
    static final long MAX_ORDER_NO = 999_999_999_999L;

    enum SyncAction { NOTHING, IGNORE, RECORD, CONFIRM }

    /** The buyer's "check with payOS": its own rate budget, separate from creating orders. */
    public OrderResponse sync(UUID actor, String code) {
        checkRate("order:sync:" + actor, SYNC_PER_MINUTE);
        var row = orders.findPayosOrder(code).filter(r -> r.getUserId().equals(actor))
                .orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));
        syncPayos(code, row);
        return tx().execute(s -> response(owned(actor, code)));
    }

    public AdminOrderResponse adminSync(String code) {
        var row = orders.findPayosOrder(code).orElseThrow(() -> new CustomException(ErrorCode.ORDER_NOT_FOUND));
        syncPayos(code, row);
        return tx().execute(s -> adminView(row.getId()));
    }

    /**
     * A correctly signed webhook is only a signal to look the order up. Unknown orders (payOS's sample
     * payload) and PAID orders end here without calling payOS; an unpaid order triggers at most one lookup
     * every 3 seconds, and a throttled signal is answered 503 so it is not taken as handled.
     */
    public void webhook(long orderNo) {
        if (orderNo <= 0 || orderNo > MAX_ORDER_NO) return;
        String code = "TV" + String.format("%012d", orderNo);
        var row = orders.findPayosOrder(code).filter(r -> Boolean.TRUE.equals(r.getPayos())).orElse(null);
        if (row == null || CourseOrder.Status.PAID.name().equals(row.getStatus())) return;
        try {
            if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent("payos:webhook:" + code, "1", java.time.Duration.ofSeconds(3))))
                throw new CustomException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        }
        syncPayos(code, row);
    }

    /** Looks the order up with no transaction open, then applies the answer under the buyer and order locks. */
    private void syncPayos(String code, OrderRepository.PayosOrderRow row) {
        if (!Boolean.TRUE.equals(row.getPayos())) throw new CustomException(ErrorCode.PAYMENT_STATE_INVALID);
        if (!payos.enabled()) throw new CustomException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        Optional<PayosClient.Payment> found;
        try {
            found = payos.lookup(PayosClient.orderNo(code));
        } catch (PayosClient.PayosException e) {
            log.warn("payOS lookup for order {} failed: {}", code, e.getMessage());
            throw new CustomException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        }
        // An error code (auth, service, unknown order) is a failed lookup: 503, so a webhook is not taken as handled.
        if (found.isEmpty()) {
            log.warn("payOS lookup for order {} answered with an error code", code);
            throw new CustomException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        }
        tx().executeWithoutResult(s -> applyPayos(code, found.get()));
    }

    /** Same lock order as {@link #confirm}; the order is read after the lock, so a second request sees PAID and stops. */
    private void applyPayos(String code, PayosClient.Payment p) {
        CourseOrder order = lockOrder(code);
        var status = order.getStatus();
        String stored = order.getPayosPaymentLinkId();
        var action = decide(status, stored, PayosClient.orderNo(code), order.getTotalAmount(), p);
        if (action == SyncAction.IGNORE) log.warn("payOS lookup for order {} does not match the order; nothing changed", code);
        if (action == SyncAction.IGNORE || action == SyncAction.NOTHING) return;
        UUID id = order.getId();
        if (stored == null && orders.savePayosLink(id, p.id()) == 0) {
            log.warn("payOS link of order {} is held by another order; nothing changed", code);
            return;
        }
        orders.recordPayosAmountPaid(id, p.amountPaid());
        if (status == CourseOrder.Status.CANCELLED || status == CourseOrder.Status.FAILED)
            log.warn("payOS reports a payment for order {} in state {}; no access granted", code, status);
        if (action == SyncAction.CONFIRM && orders.confirmPayosPayment(id, p.id()) == 0)
            log.warn("payOS order {} has no open payment row; nothing confirmed", code);
    }

    /**
     * The rule table: access only when payOS says PAID with at least the order total, for this order, amount
     * and link; anything missing or different is ignored. A PAID, cancelled or failed order only records the amount.
     */
    static SyncAction decide(CourseOrder.Status status, String storedLink, long orderNo, long total, PayosClient.Payment p) {
        if (p.id() == null || p.orderCode() == null || p.status() == null || p.amount() == null || p.amountPaid() == null
                || p.orderCode() != orderNo || p.amount() != total || storedLink != null && !storedLink.equals(p.id()))
            return SyncAction.IGNORE;
        if (p.amountPaid() <= 0) return SyncAction.NOTHING;
        boolean full = "PAID".equals(p.status()) && p.amountPaid() >= total;
        return full && (status == CourseOrder.Status.PENDING || status == CourseOrder.Status.EXPIRED)
                ? SyncAction.CONFIRM : SyncAction.RECORD;
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
        // Admin confirms manual transfers only; payOS orders are confirmed by the payOS lookup.
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
    public AuthorRevenueResponse revenue(UUID author, String courseId, String from, String to, int page, int size) {
        var range = range(from, to);
        UUID course = courseId == null || courseId.isEmpty() ? null : uuid(courseId, ErrorCode.REVENUE_FILTER_INVALID);
        if (course != null && !orders.ownsCourse(course, author)) throw new CustomException(ErrorCode.COURSE_NOT_FOUND);
        var t = orders.revenueTotals(author, course, range[0], range[1]);
        var items = orders.findRevenue(author, course, range[0], range[1], PageRequest.of(page, size));
        // Balance is always all-time: with a filter, earned and paid out come from one unfiltered statement.
        var all = course == null && from == null && to == null ? t
                : orders.revenueTotals(author, null, OrderRepository.ALWAYS_FROM, OrderRepository.ALWAYS_TO);
        return new AuthorRevenueResponse(
                new AuthorRevenueResponse.Totals(t.getItemCount(), t.getGrossAmount(), t.getPlatformAmount(), t.getAuthorAmount(),
                        all.getPaidOutAmount(), all.getAuthorAmount() - all.getPaidOutAmount()),
                PageResponse.from(items, items.stream().map(AuthorRevenueResponse.Item::of).toList()));
    }

    @Transactional(readOnly = true)
    public PageResponse<AuthorRevenueResponse.CourseRow> revenueByCourse(UUID author, String from, String to, int page, int size) {
        var range = range(from, to);
        var rows = orders.findCourseRevenue(author, range[0], range[1], PageRequest.of(page, size));
        return PageResponse.from(rows, rows.stream().map(r -> new AuthorRevenueResponse.CourseRow(
                r.getCourseId(), r.getCourseTitle(), r.getItemCount(), r.getGrossAmount(), r.getPlatformAmount(),
                r.getAuthorAmount())).toList());
    }

    @Transactional(readOnly = true)
    public AdminRevenueResponse adminRevenue(String from, String to, int page, int size) {
        var range = range(from, to);
        var t = orders.revenueTotals(null, null, range[0], range[1]);
        var l = orders.ledger();
        var rows = orders.findCourseRevenue(null, range[0], range[1], PageRequest.of(page, size));
        return new AdminRevenueResponse(
                new AdminRevenueResponse.Totals(t.getItemCount(), t.getGrossAmount(), t.getPlatformAmount(), t.getAuthorAmount()),
                new AdminRevenueResponse.Ledger(l.getEarnedAmount(), l.getPaidOutAmount(), l.getEarnedAmount() - l.getPaidOutAmount()),
                PageResponse.from(rows, rows.stream().map(r -> new AdminRevenueResponse.CourseRow(
                        r.getCourseId(), r.getCourseTitle(), r.getAuthorId(), r.getAuthorName(), r.getItemCount(),
                        r.getGrossAmount(), r.getPlatformAmount(), r.getAuthorAmount())).toList()));
    }

    private static final java.time.ZoneId VIETNAM = java.time.ZoneId.of("Asia/Ho_Chi_Minh");

    /** {@code yyyy-MM-dd} days, both ends inclusive in Vietnam time, as [from, to); null or empty = open end. */
    public static java.time.Instant[] range(String from, String to) {
        try {
            var start = from == null || from.isEmpty() ? null : java.time.LocalDate.parse(from);
            var end = to == null || to.isEmpty() ? null : java.time.LocalDate.parse(to);
            if (start != null && end != null && start.isAfter(end)) throw new CustomException(ErrorCode.REVENUE_FILTER_INVALID);
            return new java.time.Instant[] {
                    start == null ? OrderRepository.ALWAYS_FROM : start.atStartOfDay(VIETNAM).toInstant(),
                    end == null ? OrderRepository.ALWAYS_TO : end.plusDays(1).atStartOfDay(VIETNAM).toInstant()};
        } catch (java.time.format.DateTimeParseException e) {
            throw new CustomException(ErrorCode.REVENUE_FILTER_INVALID);
        }
    }

    // ------------------------------------------------------------------ author payouts

    /** VietQR BINs (api.vietqr.io/v2/banks, 2026-11-16); the only banks a payout account may use. */
    static final List<PayoutResponse.Bank> BANKS = List.of(
            new PayoutResponse.Bank("970436", "Vietcombank"),
            new PayoutResponse.Bank("970415", "VietinBank"),
            new PayoutResponse.Bank("970418", "BIDV"),
            new PayoutResponse.Bank("970405", "Agribank"),
            new PayoutResponse.Bank("970422", "MBBank"),
            new PayoutResponse.Bank("970407", "Techcombank"),
            new PayoutResponse.Bank("970416", "ACB"),
            new PayoutResponse.Bank("970432", "VPBank"),
            new PayoutResponse.Bank("970423", "TPBank"),
            new PayoutResponse.Bank("970403", "Sacombank"),
            new PayoutResponse.Bank("970437", "HDBank"),
            new PayoutResponse.Bank("970441", "VIB"),
            new PayoutResponse.Bank("970443", "SHB"),
            new PayoutResponse.Bank("970431", "Eximbank"),
            new PayoutResponse.Bank("970426", "MSB"),
            new PayoutResponse.Bank("970448", "OCB"),
            new PayoutResponse.Bank("970440", "SeABank"),
            new PayoutResponse.Bank("970449", "LPBank"),
            new PayoutResponse.Bank("970454", "VietCapitalBank"),
            new PayoutResponse.Bank("970428", "NamABank"));
    private static final Pattern PAYOUT_ACCOUNT_NO = Pattern.compile("[A-Za-z0-9]{6,30}");

    record PayoutAccountInput(String bankId, String accountNo, String accountName) {}

    @Transactional(readOnly = true)
    public PayoutResponse.AccountView payoutAccount(UUID author) {
        return accountView(author);
    }

    /** Creates or replaces the account under the author's users row lock, the lock payout recording takes too. */
    @Transactional
    public PayoutResponse.AccountView savePayoutAccount(UUID author, Map<String, Object> body) {
        var input = payoutAccountInput(body);
        users.findByIdForAuthentication(author).orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
        orders.upsertPayoutAccount(author, input.bankId(), input.accountNo(), input.accountName());
        return accountView(author);
    }

    @Transactional(readOnly = true)
    public PageResponse<PayoutResponse> payouts(UUID author, int page, int size) {
        var result = orders.findPayouts(author, PageRequest.of(page, size));
        return PageResponse.from(result, result.stream()
                .map(p -> new PayoutResponse(p.getAmount(), p.getBankReference(), maskAccountNo(p.getAccountNo()), p.getCreatedAt()))
                .toList());
    }

    private PayoutResponse.AccountView accountView(UUID author) {
        var account = orders.findPayoutAccount(author).map(a -> new PayoutResponse.Account(
                a.getBankId(), bankName(a.getBankId()), a.getAccountNo(), a.getAccountName(), a.getUpdatedAt()));
        return new PayoutResponse.AccountView(account.orElse(null), BANKS);
    }

    private static String bankName(String bankId) {
        return BANKS.stream().filter(b -> b.id().equals(bankId)).map(PayoutResponse.Bank::name).findFirst().orElse(null);
    }

    /** Exactly bankId, accountNo, accountName as strings; stripped, name upper-cased as banks print it. */
    static PayoutAccountInput payoutAccountInput(Map<String, Object> body) {
        if (body == null || body.size() != 3) throw new CustomException(ErrorCode.PAYOUT_ACCOUNT_INVALID);
        return accountInput(body, ErrorCode.PAYOUT_ACCOUNT_INVALID);
    }

    private static PayoutAccountInput accountInput(Map<String, Object> body, ErrorCode invalid) {
        if (!(body.get("bankId") instanceof String bank)
                || !(body.get("accountNo") instanceof String no)
                || !(body.get("accountName") instanceof String name))
            throw new CustomException(invalid);
        String bankId = bank.strip();
        String accountNo = no.strip();
        String accountName = name.strip().toUpperCase(Locale.ROOT);
        if (bankName(bankId) == null || !PAYOUT_ACCOUNT_NO.matcher(accountNo).matches()
                || accountName.isEmpty() || accountName.length() > 100 || accountName.chars().anyMatch(Character::isISOControl))
            throw new CustomException(invalid);
        return new PayoutAccountInput(bankId, accountNo, accountName);
    }

    // ------------------------------------------------------------------ Admin payouts

    record PayoutInput(UUID authorId, long amount, String bankReference, PayoutAccountInput account) {}

    /** Exactly six fields; amount a JSON integer (no decimals, strings or beyond long); the account the Admin paid. */
    static PayoutInput payoutInput(Map<String, Object> body) {
        if (body == null || body.size() != 6
                || !(body.get("authorId") instanceof String id)
                || !(body.get("amount") instanceof Integer || body.get("amount") instanceof Long)
                || ((Number) body.get("amount")).longValue() <= 0
                || !(body.get("bankReference") instanceof String reference)
                || reference.strip().isEmpty() || reference.strip().length() > 255)
            throw new CustomException(ErrorCode.PAYOUT_INVALID);
        return new PayoutInput(uuid(id, ErrorCode.PAYOUT_INVALID), ((Number) body.get("amount")).longValue(),
                reference.strip(), accountInput(body, ErrorCode.PAYOUT_INVALID));
    }

    /** Canonical form only: {@code UUID.fromString} also accepts short forms such as "1-1-1-1-1". */
    public static UUID uuid(String value, ErrorCode invalid) {
        try {
            UUID parsed = UUID.fromString(value);
            if (parsed.toString().equalsIgnoreCase(value)) return parsed;
        } catch (IllegalArgumentException e) {
        }
        throw new CustomException(invalid);
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminPayoutResponse.AuthorBalance> authorBalances(boolean owedOnly, int page, int size) {
        var result = orders.findAuthorBalances(owedOnly, PageRequest.of(page, size));
        return PageResponse.from(result, result.stream().map(b -> {
            var account = b.getBankId() == null ? null
                    : new PayoutResponse.Account(b.getBankId(), bankName(b.getBankId()), b.getAccountNo(), b.getAccountName(), b.getUpdatedAt());
            var qr = account == null ? null
                    : payoutQr(b.getAuthorId(), b.getBankId(), b.getAccountNo(), b.getAccountName(), b.getBalanceAmount());
            return new AdminPayoutResponse.AuthorBalance(b.getAuthorId(), b.getFullName(), b.getEmail(),
                    b.getEarnedAmount(), b.getPaidOutAmount(), b.getBalanceAmount(), account, qr);
        }).toList());
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminPayoutResponse> adminPayouts(UUID authorId, int page, int size) {
        var result = orders.findAdminPayouts(authorId, PageRequest.of(page, size));
        return PageResponse.from(result, result.stream().map(p -> adminPayoutView(p, null)).toList());
    }

    /**
     * Records a transfer the Admin already made. Locks only the author's users row (the lock
     * {@link #savePayoutAccount} takes), never an order or buyer, so it cannot deadlock with {@link #confirm}.
     * A known reference is a retry when author and amount match, a conflict otherwise; the balance is read
     * after the lock in one statement, so two Admins can never pay out more than was earned.
     */
    @Transactional
    public AdminPayoutResponse recordPayout(UUID admin, Map<String, Object> body) {
        var input = payoutInput(body);
        users.findByIdForAuthentication(input.authorId()).orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        var existing = orders.findPayoutByReference(input.bankReference());
        if (existing.isPresent()) return replay(existing.get(), input);
        var totals = orders.revenueTotals(input.authorId());
        if (input.amount() > totals.getAuthorAmount() - totals.getPaidOutAmount())
            throw new CustomException(ErrorCode.PAYOUT_EXCEEDS_BALANCE);
        var account = input.account();
        // 0 rows: another author's payout took this reference after our check (different lock).
        if (orders.insertPayout(input.authorId(), input.amount(), input.bankReference(),
                account.bankId(), account.accountNo(), account.accountName(), admin) == 0)
            return replay(orders.findPayoutByReference(input.bankReference())
                    .orElseThrow(() -> new CustomException(ErrorCode.PAYOUT_REFERENCE_CONFLICT)), input);
        return withAccountCheck(orders.findPayoutByReference(input.bankReference()).orElseThrow());
    }

    private AdminPayoutResponse replay(OrderRepository.AdminPayoutRow row, PayoutInput input) {
        if (!row.getAuthorId().equals(input.authorId()) || row.getAmount() != input.amount())
            throw new CustomException(ErrorCode.PAYOUT_REFERENCE_CONFLICT);
        return withAccountCheck(row);
    }

    private AdminPayoutResponse withAccountCheck(OrderRepository.AdminPayoutRow row) {
        var current = orders.findPayoutAccount(row.getAuthorId());
        boolean changed = current.map(a -> !a.getBankId().equals(row.getBankId())
                || !a.getAccountNo().equals(row.getAccountNo()) || !a.getAccountName().equals(row.getAccountName())).orElse(true);
        return adminPayoutView(row, changed);
    }

    private static AdminPayoutResponse adminPayoutView(OrderRepository.AdminPayoutRow p, Boolean accountChanged) {
        return new AdminPayoutResponse(p.getId(), p.getAuthorId(), p.getAuthorName(), p.getAmount(), p.getBankReference(),
                p.getBankId(), bankName(p.getBankId()), p.getAccountNo(), p.getAccountName(), p.getRecordedById(),
                p.getRecordedByName(), p.getCreatedAt(), accountChanged);
    }

    /** QR to the author's own account (not the platform's {@code vietqr.*}); null when nothing is owed. */
    OrderResponse.VietQr payoutQr(UUID author, String bank, String account, String name, long balance) {
        if (balance <= 0 || template == null || !TEMPLATE.matcher(template).matches()) return null;
        return vietQr(bank, account, name, balance, "TVPAY" + author.toString().substring(0, 8).toUpperCase(Locale.ROOT));
    }

    static String maskAccountNo(String accountNo) {
        return "****" + accountNo.substring(accountNo.length() - 4);
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
        return qrConfigured() ? vietQr(bankId, accountNo, accountName.strip(), amount, code) : null;
    }

    private OrderResponse.VietQr vietQr(String bank, String account, String name, long amount, String content) {
        String url = "https://img.vietqr.io/image/" + bank + "-" + account + "-" + template + ".png"
                + "?amount=" + amount
                + "&addInfo=" + UriUtils.encodeQueryParam(content, StandardCharsets.UTF_8)
                + "&accountName=" + UriUtils.encodeQueryParam(name, StandardCharsets.UTF_8);
        return new OrderResponse.VietQr(bank, account, name, amount, content, url);
    }

    boolean qrConfigured() {
        return bankId != null && BANK_ID.matcher(bankId).matches()
                && accountNo != null && ACCOUNT_NO.matcher(accountNo).matches()
                && accountName != null && !accountName.isBlank()
                && template != null && TEMPLATE.matcher(template).matches();
    }

    /** Create and transfer-report share one budget per user, retries included. */
    void checkRate(UUID actor) {
        checkRate("order:rate:" + actor, requestsPerMinute);
    }

    private void checkRate(String key, int perMinute) {
        try {
            Long count = redis.execute(COUNTER, List.of(key));
            if (count == null) throw new CustomException(ErrorCode.PAYMENT_UNAVAILABLE);
            if (count > perMinute) throw new CustomException(ErrorCode.ORDER_RATE_LIMITED);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.PAYMENT_UNAVAILABLE);
        }
    }
}
