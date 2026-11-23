package com.techverse.server.repository;

import lombok.RequiredArgsConstructor;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Map;

/**
 * Read-only counts for the overview pages. Each endpoint is one statement of scalar subqueries, so
 * now() is taken once per request. Conditions mirror the source modules' own queries:
 * review queues (ModeratorArticleSpecification, CourseSpecification, Moderator*Service) and admin
 * order filters (OrderRepository.findForAdmin). Sums come back as numeric (or null on no rows).
 */
@Repository
@RequiredArgsConstructor
public class DashboardRepository {
    private static final String PAID = "FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status = 'PAID'";
    private static final String LAST_30 = " AND o.paid_at > now() - interval '30 days' AND o.paid_at <= now()";

    private static final String ADMIN = "SELECT"
            + " (SELECT count(*) FROM users) AS users_total,"
            + " (SELECT count(*) FROM users WHERE is_active) AS users_active,"
            + " (SELECT count(*) FROM users WHERE NOT is_active) AS users_locked,"
            + " (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days' AND created_at <= now()) AS users_new_7,"
            + " (SELECT count(*) FROM author_profiles WHERE status = 'APPROVED') AS authors_approved,"
            + " (SELECT count(*) FROM author_profiles WHERE status = 'SUSPENDED') AS authors_suspended,"
            + " (SELECT count(*) FROM author_profiles WHERE status = 'PENDING') AS authors_pending,"
            + " (SELECT count(*) FROM articles WHERE publication_status = 'PUBLISHED') AS content_articles,"
            + " (SELECT count(*) FROM courses WHERE publication_status = 'PUBLISHED') AS content_courses,"
            + " (SELECT count(*) FROM exercise_sets WHERE status = 'PUBLISHED') AS content_exercise_sets,"
            + " (SELECT count(*) FROM interview_questions WHERE status = 'PUBLISHED') AS content_interview_questions,"
            + " (SELECT count(*) FROM forum_posts WHERE parent_id IS NULL AND status = 'VISIBLE') AS content_forum_questions,"
            + " (SELECT count(*) FROM orders WHERE transfer_reported_at IS NOT NULL AND status IN ('PENDING', 'EXPIRED'))"
            + " AS orders_awaiting,"
            + " (SELECT count(*) FROM orders WHERE needs_reconciliation) AS orders_reconciliation,"
            // Orders → items only: joining payment_transactions would count a twice-paid order twice.
            + " (SELECT count(*) FROM orders o WHERE o.status = 'PAID') AS all_orders,"
            + " (SELECT sum(i.unit_price_amount) " + PAID + ") AS all_gross,"
            + " (SELECT sum(i.commission_amount) " + PAID + ") AS all_platform,"
            + " (SELECT sum(i.author_net_amount) " + PAID + ") AS all_author,"
            + " (SELECT count(*) FROM orders o WHERE o.status = 'PAID'" + LAST_30 + ") AS last30_orders,"
            + " (SELECT sum(i.unit_price_amount) " + PAID + LAST_30 + ") AS last30_gross,"
            + " (SELECT sum(i.commission_amount) " + PAID + LAST_30 + ") AS last30_platform,"
            + " (SELECT sum(i.author_net_amount) " + PAID + LAST_30 + ") AS last30_author";

    private static final String MODERATOR = "SELECT"
            + " (SELECT count(*) FROM articles WHERE workflow_status = 'PENDING' AND publication_status <> 'AUTHOR_DELETED')"
            + " AS pending_articles,"
            + " (SELECT count(*) FROM courses WHERE workflow_status = 'PENDING' AND publication_status <> 'AUTHOR_DELETED')"
            + " AS pending_courses,"
            + " (SELECT count(*) FROM exercise_sets WHERE status = 'PENDING') AS pending_exercise_sets,"
            + " (SELECT count(*) FROM interview_questions WHERE status = 'PENDING') AS pending_interview_questions,"
            + " (SELECT count(*) FROM reports WHERE status = 'OPEN') AS reports_open,"
            + " (SELECT count(*) FROM forum_posts WHERE status = 'HIDDEN') AS reports_hidden_posts";

    private final JdbcTemplate jdbc;

    public Map<String, Object> adminCounts() {
        return jdbc.queryForMap(ADMIN);
    }

    public Map<String, Object> moderatorCounts() {
        return jdbc.queryForMap(MODERATOR);
    }
}
