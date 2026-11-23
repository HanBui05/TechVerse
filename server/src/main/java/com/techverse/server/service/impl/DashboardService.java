package com.techverse.server.service.impl;

import com.techverse.server.dto.response.DashboardResponse.*;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.DashboardRepository;
import com.techverse.server.repository.UserRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/** Overview counts; a failing count fails the whole request (no partial numbers). */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {
    /** Largest integer a JavaScript number holds exactly; a bigger total is an error, never a wrong number. */
    static final long MAX_SAFE = (1L << 53) - 1;

    private final DashboardRepository dashboard;
    private final UserRepository users;

    public Admin admin(UUID actor) {
        requireActive(actor, RoleName.ADMIN);
        var r = dashboard.adminCounts();
        return new Admin(
                new Users(n(r, "users_total"), n(r, "users_active"), n(r, "users_locked"), n(r, "users_new_7")),
                new Authors(n(r, "authors_approved"), n(r, "authors_suspended"), n(r, "authors_pending")),
                new Content(n(r, "content_articles"), n(r, "content_courses"), n(r, "content_exercise_sets"),
                        n(r, "content_interview_questions"), n(r, "content_forum_questions")),
                new Orders(n(r, "orders_awaiting"), n(r, "orders_reconciliation")),
                new Revenue(period(r, "all"), period(r, "last30")));
    }

    public Moderator moderator(UUID actor) {
        requireActive(actor, RoleName.MODERATOR);
        var r = dashboard.moderatorCounts();
        return new Moderator(
                new Pending(n(r, "pending_articles"), n(r, "pending_courses"), n(r, "pending_exercise_sets"),
                        n(r, "pending_interview_questions")),
                new Reports(n(r, "reports_open"), n(r, "reports_hidden_posts")));
    }

    private void requireActive(UUID actor, RoleName role) {
        User user = users.findWithRolesById(actor).orElse(null);
        if (user == null || !user.isActive()
                || user.getUserRoles().stream().noneMatch(link -> link.getRole().getName() == role))
            throw new CustomException(ErrorCode.ACCESS_DENIED);
    }

    private static Period period(Map<String, Object> r, String prefix) {
        return new Period(n(r, prefix + "_orders"), n(r, prefix + "_gross"), n(r, prefix + "_platform"), n(r, prefix + "_author"));
    }

    /** SUM over no rows is NULL → 0; anything past {@link #MAX_SAFE} throws (logged as a server error). */
    static long n(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value == null) return 0;
        BigDecimal number = value instanceof BigDecimal d ? d : new BigDecimal(value.toString());
        if (number.compareTo(BigDecimal.valueOf(MAX_SAFE)) > 0)
            throw new IllegalStateException("Dashboard value " + key + " exceeds 2^53 - 1");
        return number.longValueExact();
    }
}
