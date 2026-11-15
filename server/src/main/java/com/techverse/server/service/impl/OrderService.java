package com.techverse.server.service.impl;

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

    // ------------------------------------------------------------------ helpers

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
