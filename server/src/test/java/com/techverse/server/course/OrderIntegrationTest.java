package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;

/** Orders and VietQR (manual transfer, Admin confirms later); no real VietQR call. */
class OrderIntegrationTest extends CourseIntegrationTestBase {
    static final String ORDERS = "/api/v1/orders";

    String paid;
    @org.springframework.beans.factory.annotation.Autowired javax.sql.DataSource dataSource;

    @BeforeEach
    void orderSetup() throws Exception {
        // TRUNCATE users CASCADE also empties commission_policies.
        jdbc.update("INSERT INTO techverse.commission_policies (rate_bps) VALUES (2000)");
        paid = publishedPaidCourse("Paid course", 199_000);
    }

    @Test
    void createsAPendingManualOrderWithSnapshotsTriggerTotalsAndVietQr() throws Exception {
        var order = data(buy(paid, learnerToken).andExpect(status().isOk()));
        String code = order.path("orderCode").asText();
        assertThat(code).matches("TV\\d{12}");
        assertThat(order.path("courseId").asText()).isEqualTo(paid);
        assertThat(order.path("courseTitle").asText()).isEqualTo("Paid course");
        assertThat(order.path("amount").asLong()).isEqualTo(199_000);
        assertThat(order.path("currency").asText()).isEqualTo("VND");
        assertThat(order.path("status").asText()).isEqualTo("PENDING");
        assertThat(order.path("transferReportedAt").isNull()).isTrue();
        var created = Instant.parse(order.path("createdAt").asText());
        assertThat(Instant.parse(order.path("expiresAt").asText())).isCloseTo(created.plus(24, ChronoUnit.HOURS), within());
        var qr = order.path("vietQr");
        assertThat(qr.path("bankId").asText()).isEqualTo("970422");
        assertThat(qr.path("accountNo").asText()).isEqualTo("0123456789");
        assertThat(qr.path("accountName").asText()).isEqualTo("NGUYEN VAN A");
        assertThat(qr.path("amount").asLong()).isEqualTo(199_000);
        assertThat(qr.path("content").asText()).isEqualTo(code);
        assertThat(qr.path("imageUrl").asText()).isEqualTo("https://img.vietqr.io/image/970422-0123456789-compact2.png"
                + "?amount=199000&addInfo=" + code + "&accountName=NGUYEN%20VAN%20A");
        assertThat(order.toString()).doesNotContain("commission", "\"id\"", "userId");

        var row = jdbc.queryForMap("SELECT o.total_amount, o.status, EXTRACT(EPOCH FROM o.expires_at - o.created_at)::bigint AS ttl, i.unit_price_amount,"
                + " i.commission_rate_bps, i.commission_amount, i.author_net_amount, i.course_title_snapshot"
                + " FROM techverse.orders o JOIN techverse.order_items i ON i.order_id = o.id WHERE o.order_code = ?", code);
        assertThat(row.get("total_amount")).isEqualTo(199_000L);
        assertThat(row.get("ttl")).isEqualTo(86_400L);
        assertThat(row.get("commission_rate_bps")).isEqualTo(2000);
        assertThat(row.get("commission_amount")).isEqualTo(39_800L);
        assertThat(row.get("author_net_amount")).isEqualTo(159_200L);
        var tx = jdbc.queryForMap("SELECT t.provider, t.status, t.amount FROM techverse.payment_transactions t"
                + " JOIN techverse.orders o ON o.id = t.order_id WHERE o.order_code = ?", code);
        assertThat(tx).containsEntry("provider", "MANUAL").containsEntry("status", "PENDING").containsEntry("amount", 199_000L);
        assertThat(enrollmentCount()).isZero();
    }

    @Test
    void repeatedAndConcurrentRequestsReturnTheSamePendingOrderAndKeepTheSnapshot() throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<String> call = () -> data(buy(paid, learnerToken).andExpect(status().isOk())).path("orderCode").asText();
            var a = pool.submit(call);
            var b = pool.submit(call);
            assertThat(a.get(20, TimeUnit.SECONDS)).isEqualTo(b.get(20, TimeUnit.SECONDS));
        } finally {
            pool.shutdownNow();
        }
        // Price and policy changes after creation do not touch the order.
        jdbc.update("UPDATE techverse.courses SET price_amount = 500000 WHERE id = ?::uuid", paid);
        jdbc.update("UPDATE techverse.commission_policies SET is_active = false, effective_to = clock_timestamp()");
        jdbc.update("INSERT INTO techverse.commission_policies (rate_bps) VALUES (3000)");
        var again = data(buy(paid, learnerToken).andExpect(status().isOk()));
        assertThat(again.path("amount").asLong()).isEqualTo(199_000);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.orders", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT commission_amount FROM techverse.order_items", Long.class)).isEqualTo(39_800L);
    }

    @Test
    void anExpiredOrderIsKeptAndANewOrderUsesTheCurrentPrice() throws Exception {
        String first = data(buy(paid, learnerToken)).path("orderCode").asText();
        expire(first);
        jdbc.update("UPDATE techverse.courses SET price_amount = 250000 WHERE id = ?::uuid", paid);
        var second = data(buy(paid, learnerToken).andExpect(status().isOk()));
        assertThat(second.path("orderCode").asText()).isNotEqualTo(first);
        assertThat(second.path("amount").asLong()).isEqualTo(250_000);

        var old = data(get(ORDERS + "/" + first, learnerToken).andExpect(status().isOk()));
        assertThat(old.path("status").asText()).isEqualTo("EXPIRED");
        assertThat(old.path("amount").asLong()).isEqualTo(199_000);
        assertThat(old.path("vietQr").path("content").asText()).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT t.status FROM techverse.payment_transactions t JOIN techverse.orders o"
                + " ON o.id = t.order_id WHERE o.order_code = ?", String.class, first)).isEqualTo("EXPIRED");

        var mine = data(get("/api/v1/me/orders?page=0&size=1", learnerToken).andExpect(status().isOk()));
        assertThat(mine.path("totalElements").asLong()).isEqualTo(2);
        assertThat(mine.at("/content/0/orderCode").asText()).isEqualTo(second.path("orderCode").asText());
    }

    @Test
    void aRequestThatWaitsForTheUserLockPastTheDeadlineGetsANewOrder() throws Exception {
        String first = data(buy(paid, learnerToken)).path("orderCode").asText();
        jdbc.update("UPDATE techverse.orders SET expires_at = now() + interval '1 second' WHERE order_code = ?", first);
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var lock = connection.prepareStatement("SELECT 1 FROM techverse.users WHERE id = ? FOR UPDATE")) {
                lock.setObject(1, learner);
                lock.executeQuery();
            }
            var pending = CompletableFuture.supplyAsync(() -> {
                try {
                    return data(buy(paid, learnerToken)).path("orderCode").asText();
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            Thread.sleep(2000);
            connection.rollback();
            assertThat(pending.get(10, TimeUnit.SECONDS)).isNotEqualTo(first);
        }
    }

    @Test
    void readingAnOverdueOrderMarksItExpired() throws Exception {
        String code = data(buy(paid, learnerToken)).path("orderCode").asText();
        expire(code);
        get("/api/v1/me/orders", learnerToken).andExpect(jsonPath("$.data.content[0].status").value("EXPIRED"));
    }

    @Test
    void rejectsGuestsManagersOwnersAndCoursesThatCannotBeBought() throws Exception {
        buy(paid, null).andExpect(status().isUnauthorized());
        buy(paid, adminToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        buy(paid, modToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        buy(paid, authorToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        buy(publishedCourse("Free course"), learnerToken)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_COURSE_UNAVAILABLE"));
        buy(UUID.randomUUID().toString(), learnerToken)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        var draft = new LinkedHashMap<String, List<String>>();
        draft.put("A", List.of("A1"));
        buy(course("Draft", draft), learnerToken)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.orders", Long.class)).isZero();
    }

    @Test
    void rejectsInvalidBodiesAndClientSuppliedAmounts() throws Exception {
        for (Map<String, ?> body : List.<Map<String, ?>>of(
                Map.of(), Map.of("courseId", "not-a-uuid"), Map.of("courseId", 12),
                Map.of("courseId", paid, "priceAmount", 1), Map.of("courseId", paid, "totalAmount", 1)))
            send(post(ORDERS), learnerToken, body)
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("ORDER_INVALID"));
    }

    @Test
    void enrolledLearnersCannotOrderAgain() throws Exception {
        UUID admin = jdbc.queryForObject("SELECT id FROM techverse.users WHERE email = 'admin@example.com'", UUID.class);
        jdbc.update("INSERT INTO techverse.course_enrollments (user_id, course_id, source, granted_by) VALUES (?, ?::uuid, 'ADMIN_GRANT', ?)",
                learner, paid, admin);
        buy(paid, learnerToken).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_ALREADY_ENROLLED"));
    }

    @Test
    void noActiveCommissionPolicyMeansPaymentUnavailable() throws Exception {
        jdbc.update("UPDATE techverse.commission_policies SET is_active = false");
        buy(paid, learnerToken)
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("PAYMENT_UNAVAILABLE"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.orders", Long.class)).isZero();
    }

    @Test
    void ordersAreVisibleOnlyToTheirOwner() throws Exception {
        String code = data(buy(paid, learnerToken)).path("orderCode").asText();
        user("other@example.com", null);
        String other = login("other@example.com");
        get(ORDERS + "/" + code, other).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
        get(ORDERS + "/" + code, null).andExpect(status().isUnauthorized());
        get(ORDERS + "/TV999999999999", learnerToken).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
        get(ORDERS + "/garbage", learnerToken).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
        get("/api/v1/me/orders", other).andExpect(jsonPath("$.data.totalElements").value(0));
        report(code, other).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT transfer_reported_at FROM techverse.orders", Instant.class)).isNull();
    }

    @Test
    void transferReportKeepsTheFirstTimeAndChangesNeitherStatusNorAccess() throws Exception {
        String code = data(buy(paid, learnerToken)).path("orderCode").asText();
        var first = data(report(code, learnerToken).andExpect(status().isOk()));
        assertThat(first.path("status").asText()).isEqualTo("PENDING");
        String at = first.path("transferReportedAt").asText();
        assertThat(at).isNotBlank().isNotEqualTo("null");
        Thread.sleep(20);
        var second = data(report(code, learnerToken).andExpect(status().isOk()));
        assertThat(second.path("transferReportedAt").asText()).isEqualTo(at);
        assertThat(data(get(ORDERS + "/" + code, learnerToken)).path("transferReportedAt").asText()).isEqualTo(at);
        assertThat(enrollmentCount()).isZero();

        expire(code);
        report(code, learnerToken).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("EXPIRED"));
    }

    @Test
    void transferReportIsRejectedForPaidOrders() throws Exception {
        String code = data(buy(paid, learnerToken)).path("orderCode").asText();
        jdbc.update("UPDATE techverse.payment_transactions SET status = 'SUCCEEDED'");
        report(code, learnerToken)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_TRANSFER_REPORT_NOT_ALLOWED"));
        assertThat(jdbc.queryForObject("SELECT transfer_reported_at FROM techverse.orders", Instant.class)).isNull();
    }

    @Test
    void createAndTransferReportShareAFivePerMinuteLimit() throws Exception {
        String code = data(buy(paid, learnerToken).andExpect(status().isOk())).path("orderCode").asText();
        for (int i = 0; i < 2; i++) buy(paid, learnerToken).andExpect(status().isOk());
        for (int i = 0; i < 2; i++) report(code, learnerToken).andExpect(status().isOk());
        buy(paid, learnerToken).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("ORDER_RATE_LIMITED"));
        report(code, learnerToken).andExpect(jsonPath("$.code").value("ORDER_RATE_LIMITED"));
    }

    // ------------------------------------------------------------------ helpers

    ResultActions buy(String course, String token) throws Exception {
        return send(post(ORDERS), token, Map.of("courseId", course));
    }

    ResultActions report(String code, String token) throws Exception {
        return send(post(ORDERS + "/" + code + "/transfer-report"), token, Map.of());
    }

    void expire(String code) {
        jdbc.update("UPDATE techverse.orders SET expires_at = now() - interval '1 minute' WHERE order_code = ?", code);
    }

    long enrollmentCount() {
        return jdbc.queryForObject("SELECT count(*) FROM techverse.course_enrollments", Long.class);
    }

    static org.assertj.core.data.TemporalUnitOffset within() {
        return org.assertj.core.api.Assertions.within(2, ChronoUnit.SECONDS);
    }
}
