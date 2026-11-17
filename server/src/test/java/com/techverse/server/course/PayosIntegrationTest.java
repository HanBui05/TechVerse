package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.service.impl.PayosClient;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/** payOS orders and the "ensure link" step against a real DB; payOS itself is stubbed on the client spy. */
class PayosIntegrationTest extends CourseIntegrationTestBase {
    static final String ORDERS = "/api/v1/orders";
    static final String CHECKOUT = "https://pay.payos.vn/web/";

    @Autowired javax.sql.DataSource dataSource;
    // Own context key (one extra context): putting the spy in the base would split it from AuthorArticleIntegrationTest.
    @MockitoSpyBean PayosClient payos;
    String course;

    @BeforeEach
    void payosSetup() throws Exception {
        // TRUNCATE users CASCADE also empties commission_policies.
        jdbc.update("INSERT INTO techverse.commission_policies (rate_bps) VALUES (2000)");
        course = publishedPaidCourse("Paid course", 199_000);
        doReturn(true).when(payos).enabled();
        doReturn(Optional.empty()).when(payos).find(anyLong(), anyLong());
        doReturn("link_1").when(payos).create(anyString(), anyLong(), any());
    }

    @Test
    void createsAPayosOrderWithAFifteenMinuteDeadlineAndACheckoutLink() throws Exception {
        var order = data(buy(course).andExpect(status().isOk()));
        String code = order.path("orderCode").asText();
        assertThat(order.path("provider").asText()).isEqualTo("PAYOS");
        assertThat(order.path("status").asText()).isEqualTo("PENDING");
        assertThat(order.path("checkoutUrl").asText()).isEqualTo(CHECKOUT + "link_1");
        assertThat(order.path("vietQr").isNull()).isTrue();
        assertThat(order.path("amountPaid").isNull()).isTrue();
        assertThat(jdbc.queryForObject("SELECT extract(epoch FROM expires_at - created_at) FROM techverse.orders", Double.class))
                .isBetween(899.0, 900.0);
        assertThat(jdbc.queryForMap("SELECT provider, status, amount FROM techverse.payment_transactions"))
                .containsEntry("provider", "PAYOS").containsEntry("status", "PENDING").containsEntry("amount", 199_000L);
        assertThat(link(code)).isEqualTo("link_1");
        Instant expires = Instant.parse(order.path("expiresAt").asText());
        verify(payos).create(eq(code), eq(199_000L), argThat(at -> Math.abs(at.getEpochSecond() - expires.getEpochSecond()) <= 1));

        // Open order returned again: the stored link, no second payOS call.
        assertThat(data(buy(course).andExpect(status().isOk())).path("checkoutUrl").asText()).isEqualTo(CHECKOUT + "link_1");
        verify(payos, times(1)).find(anyLong(), anyLong());
        verify(payos, times(1)).create(anyString(), anyLong(), any());
    }

    @Test
    void failuresLeaveNoLinkAndTheClaimIsRetakenOnlyAfterSixtySecondsLookingUpFirst() throws Exception {
        doThrow(new PayosClient.PayosException("down")).when(payos).find(anyLong(), anyLong());
        var order = data(buy(course).andExpect(status().isOk()));
        String code = order.path("orderCode").asText();
        assertThat(order.path("status").asText()).isEqualTo("PENDING");
        assertThat(order.path("checkoutUrl").isNull()).isTrue();

        // Within 60 seconds nobody calls payOS again.
        doReturn(Optional.empty()).when(payos).find(anyLong(), anyLong());
        doThrow(new PayosClient.PayosException("timeout")).when(payos).create(anyString(), anyLong(), any());
        assertThat(detail(code).path("checkoutUrl").isNull()).isTrue();
        age(code, 59);
        assertThat(detail(code).path("checkoutUrl").isNull()).isTrue();
        verify(payos, times(1)).find(anyLong(), anyLong());

        // After 60 seconds: looks up, creates, payOS times out (link may exist on payOS now).
        age(code, 61);
        assertThat(detail(code).path("checkoutUrl").isNull()).isTrue();
        verify(payos, times(2)).find(anyLong(), anyLong());
        verify(payos, times(1)).create(anyString(), anyLong(), any());

        // Next attempt finds the link payOS made and never creates a second one.
        doReturn(Optional.of("link_1")).when(payos).find(anyLong(), anyLong());
        age(code, 61);
        assertThat(detail(code).path("checkoutUrl").asText()).isEqualTo(CHECKOUT + "link_1");
        verify(payos, times(1)).create(anyString(), anyLong(), any());
        assertThat(link(code)).isEqualTo("link_1");
    }

    @Test
    void concurrentRequestsCallPayosOnceAndNoTransactionOrLockIsHeldWhileWaiting() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(i -> {
            entered.countDown();
            release.await(10, TimeUnit.SECONDS);
            return Optional.empty();
        }).when(payos).find(anyLong(), anyLong());
        var pool = Executors.newSingleThreadExecutor();
        try {
            Future<JsonNode> first = pool.submit(() -> data(buy(course).andExpect(status().isOk())));
            assertThat(entered.await(10, TimeUnit.SECONDS)).isTrue();
            String code = jdbc.queryForObject("SELECT order_code FROM techverse.orders", String.class);

            try (var c = dataSource.getConnection(); var s = c.createStatement()) {
                c.setAutoCommit(false);
                s.execute("SET LOCAL lock_timeout = '1s'");
                s.execute("UPDATE techverse.orders SET transfer_reported_at = transfer_reported_at WHERE order_code = '" + code + "'");
                s.execute("SELECT 1 FROM techverse.users WHERE id = '" + learner + "' FOR UPDATE NOWAIT");
                var rs = s.executeQuery("SELECT pg_try_advisory_xact_lock(7305001), (SELECT count(*) FROM pg_stat_activity"
                        + " WHERE datname = current_database() AND state LIKE 'idle in transaction%')");
                rs.next();
                assertThat(rs.getBoolean(1)).as("commission lock free").isTrue();
                assertThat(rs.getLong(2)).as("open transactions").isZero();
                c.rollback();
            }

            // The second request sees the claim and does not call payOS.
            assertThat(detail(code).path("checkoutUrl").isNull()).isTrue();
            release.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).path("checkoutUrl").asText()).isEqualTo(CHECKOUT + "link_1");
            verify(payos, times(1)).find(anyLong(), anyLong());
            verify(payos, times(1)).create(anyString(), anyLong(), any());
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void aLinkSavedMeanwhileOrOwnedByAnotherOrderIsNeverOverwritten() throws Exception {
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(i -> {
            entered.countDown();
            release.await(10, TimeUnit.SECONDS);
            return Optional.empty();
        }).when(payos).find(anyLong(), anyLong());
        var pool = Executors.newSingleThreadExecutor();
        String code;
        try {
            Future<JsonNode> first = pool.submit(() -> data(buy(course).andExpect(status().isOk())));
            assertThat(entered.await(10, TimeUnit.SECONDS)).isTrue();
            code = jdbc.queryForObject("SELECT order_code FROM techverse.orders", String.class);
            jdbc.update("UPDATE techverse.orders SET payos_payment_link_id = 'link_sync' WHERE order_code = ?", code);
            release.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS).path("checkoutUrl").asText()).isEqualTo(CHECKOUT + "link_sync");
            assertThat(link(code)).isEqualTo("link_sync");
        } finally {
            release.countDown();
            pool.shutdownNow();
        }

        // payOS hands back a link id another order already has: not stored, no 500.
        doReturn(Optional.empty()).when(payos).find(anyLong(), anyLong());
        doReturn("link_sync").when(payos).create(anyString(), anyLong(), any());
        String second = publishedPaidCourse("Second course", 99_000);
        var order = data(buy(second).andExpect(status().isOk()));
        assertThat(order.path("checkoutUrl").isNull()).isTrue();
        assertThat(link(order.path("orderCode").asText())).isNull();
        assertThat(link(code)).isEqualTo("link_sync");
    }

    @Test
    void transferReportOnAPayosOrderIsRejected() throws Exception {
        String code = data(buy(course)).path("orderCode").asText();
        send(post(ORDERS + "/" + code + "/transfer-report"), learnerToken, Map.of())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ORDER_TRANSFER_REPORT_NOT_ALLOWED"));
        assertThat(jdbc.queryForObject("SELECT transfer_reported_at FROM techverse.orders", Instant.class)).isNull();
    }

    // ------------------------------------------------------------------ confirmation: lookup and webhook

    @Test
    void validWebhookPaysOnceFromTheLookupWhileBadSignaturesAndUnknownOrdersChangeNothing() throws Exception {
        String code = data(buy(course)).path("orderCode").asText();
        long no = PayosClient.orderNo(code);
        paysOnPayos(no, "PAID", 199_000);

        webhook(signed(no, "link_1", 199_000).replace("\"signature\":\"", "\"signature\":\"0"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYMENT_WEBHOOK_INVALID"));
        webhook("{\"data\":").andExpect(status().isBadRequest());
        // Correctly signed (the signature covers data only) but 17 KB: refused on size alone.
        webhook(signed(no, "link_1", 199_000).replace("{\"code\"", "{\"pad\":\"" + "x".repeat(17 * 1024) + "\",\"code\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PAYMENT_WEBHOOK_INVALID"));
        // The sample payload payOS sends when the URL is registered matches no order.
        webhook(signed(123, "sample", 3_000)).andExpect(status().isOk());
        verify(payos, never()).lookup(anyLong());
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.orders", String.class)).isEqualTo("PENDING");

        // No token needed here; every other route still asks for one.
        webhook(signed(no, "link_1", 1)).andExpect(status().isOk());
        assertThat(jdbc.queryForMap("SELECT status, payos_amount_paid FROM techverse.orders"))
                .containsEntry("status", "PAID").containsEntry("payos_amount_paid", 199_000L);
        assertThat(jdbc.queryForMap("SELECT provider_transaction_id, confirmation_source, confirmed_by, status"
                + " FROM techverse.payment_transactions"))
                .containsEntry("provider_transaction_id", "link_1").containsEntry("confirmation_source", "PAYOS")
                .containsEntry("confirmed_by", null).containsEntry("status", "SUCCEEDED");
        assertThat(enrollments()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.order_items i JOIN techverse.orders o ON o.id = i.order_id"
                + " WHERE o.status = 'PAID'", Long.class)).isEqualTo(1);
        get(ORDERS + "/" + code, null).andExpect(status().isUnauthorized());

        // Replays for a PAID order never reach payOS.
        webhook(signed(no, "link_1", 199_000)).andExpect(status().isOk());
        webhook(signed(no, "link_1", 199_000)).andExpect(status().isOk());
        verify(payos, times(1)).lookup(anyLong());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.payment_transactions WHERE status = 'SUCCEEDED'", Long.class))
                .isEqualTo(1);
    }

    @Test
    void webhooksPilingUpForAnUnpaidOrderTriggerOneLookupEveryThreeSeconds() throws Exception {
        long no = PayosClient.orderNo(data(buy(course)).path("orderCode").asText());
        paysOnPayos(no, "PENDING", 0);
        webhook(signed(no, "link_1", 199_000)).andExpect(status().isOk());
        for (int i = 0; i < 4; i++)
            webhook(signed(no, "link_1", 199_000)).andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("PAYMENT_PROVIDER_UNAVAILABLE"));
        verify(payos, times(1)).lookup(anyLong());
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.orders", String.class)).isEqualTo("PENDING");
    }

    @Test
    void shortPaymentIsShownThenTheRestPaysAndALateStaleLookupNeverGoesBack() throws Exception {
        String code = data(buy(course)).path("orderCode").asText();
        long no = PayosClient.orderNo(code);
        paysOnPayos(no, "PENDING", 50_000);
        var order = data(sync(code, learnerToken).andExpect(status().isOk()));
        assertThat(order.path("status").asText()).isEqualTo("PENDING");
        assertThat(order.path("amountPaid").asLong()).isEqualTo(50_000);
        assertThat(order.path("checkoutUrl").asText()).isEqualTo(CHECKOUT + "link_1");
        assertThat(enrollments()).isZero();

        paysOnPayos(no, "PAID", 199_000);
        assertThat(data(sync(code, learnerToken).andExpect(status().isOk())).path("status").asText()).isEqualTo("PAID");
        // The older answer arrives last: still PAID, the amount never shrinks.
        paysOnPayos(no, "PENDING", 50_000);
        order = data(sync(code, learnerToken).andExpect(status().isOk()));
        assertThat(order.path("status").asText()).isEqualTo("PAID");
        assertThat(order.path("amountPaid").asLong()).isEqualTo(199_000);
        assertThat(enrollments()).isEqualTo(1);
    }

    @Test
    void anExpiredOrderPaidLateIsGrantedAndAnAlreadyEnrolledLearnerFlagsReconciliation() throws Exception {
        String code = data(buy(course)).path("orderCode").asText();
        jdbc.update("UPDATE techverse.orders SET expires_at = clock_timestamp() - interval '1 minute'");
        assertThat(detail(code).path("status").asText()).isEqualTo("EXPIRED");
        paysOnPayos(PayosClient.orderNo(code), "PAID", 199_000);
        assertThat(data(sync(code, learnerToken).andExpect(status().isOk())).path("status").asText()).isEqualTo("PAID");
        assertThat(enrollments()).isEqualTo(1);

        String second = publishedPaidCourse("Second course", 99_000);
        doReturn("link_2").when(payos).create(anyString(), anyLong(), any());
        String code2 = data(buy(second)).path("orderCode").asText();
        jdbc.update("INSERT INTO techverse.course_enrollments (user_id, course_id, source, granted_by) VALUES (?, ?::uuid, 'ADMIN_GRANT',"
                + " (SELECT id FROM techverse.users WHERE email = 'admin@example.com'))", learner, second);
        doReturn(Optional.of(new PayosClient.Payment("link_2", PayosClient.orderNo(code2), "PAID", 99_000L, 99_000L)))
                .when(payos).lookup(PayosClient.orderNo(code2));
        assertThat(data(sync(code2, learnerToken).andExpect(status().isOk())).path("status").asText()).isEqualTo("PAID");
        assertThat(jdbc.queryForObject("SELECT needs_reconciliation FROM techverse.orders WHERE order_code = ?", Boolean.class, code2))
                .isTrue();
        assertThat(enrollments()).isEqualTo(2);
    }

    @Test
    void syncRoutesCheckOwnerRoleProviderAndTheirOwnRateLimit() throws Exception {
        String code = data(buy(course)).path("orderCode").asText();
        long no = PayosClient.orderNo(code);
        sync(code, null).andExpect(status().isUnauthorized());
        String other = login(userEmail("other@example.com"));
        sync(code, other).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
        // payOS answering with an error code (auth, service) is a failed lookup too, never "nothing to do".
        sync(code, learnerToken).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PAYMENT_PROVIDER_UNAVAILABLE"));
        webhook(signed(no, "link_1", 199_000)).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PAYMENT_PROVIDER_UNAVAILABLE"));
        doThrow(new PayosClient.PayosException("down")).when(payos).lookup(anyLong());
        sync(code, learnerToken).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PAYMENT_PROVIDER_UNAVAILABLE"));

        paysOnPayos(no, "PENDING", 30_000);
        send(post("/api/v1/admin/orders/" + code + "/sync"), authorToken, Map.of()).andExpect(status().isForbidden());
        var admin = data(send(post("/api/v1/admin/orders/" + code + "/sync"), adminToken, Map.of()).andExpect(status().isOk()));
        assertThat(admin.path("provider").asText()).isEqualTo("PAYOS");
        assertThat(admin.path("amountPaid").asLong()).isEqualTo(30_000);
        send(post("/api/v1/admin/orders/" + code + "/confirm"), adminToken, Map.of("amount", 199_000, "bankReference", "FT1"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_STATE_INVALID"));

        // 10 per minute for the learner's sync (2 used above), its own budget: buying still works after.
        for (int i = 0; i < 8; i++) sync(code, learnerToken).andExpect(status().isOk());
        sync(code, learnerToken).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("ORDER_RATE_LIMITED"));
        buy(course).andExpect(status().isOk());

        // A manual order is not synced with payOS.
        doReturn(false).when(payos).enabled();
        String manual = data(buy(publishedPaidCourse("Manual course", 50_000))).path("orderCode").asText();
        send(post("/api/v1/admin/orders/" + manual + "/sync"), adminToken, Map.of())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_STATE_INVALID"));
    }

    @Test
    void concurrentWebhooksAndSyncsWriteOneSuccessfulPaymentAndNoRequestFails() throws Exception {
        String code = data(buy(course)).path("orderCode").asText();
        long no = PayosClient.orderNo(code);
        var arrived = new CountDownLatch(3);
        doAnswer(i -> {
            arrived.countDown();
            arrived.await(10, TimeUnit.SECONDS); // everyone has the PAID answer before anyone locks
            return Optional.of(new PayosClient.Payment("link_1", no, "PAID", 199_000L, 199_000L));
        }).when(payos).lookup(no);
        String body = signed(no, "link_1", 199_000);
        var pool = Executors.newFixedThreadPool(4);
        try {
            var calls = List.<Callable<Integer>>of(
                    () -> webhook(body).andReturn().getResponse().getStatus(),
                    () -> webhook(body).andReturn().getResponse().getStatus(),
                    () -> sync(code, learnerToken).andReturn().getResponse().getStatus(),
                    () -> send(post("/api/v1/admin/orders/" + code + "/sync"), adminToken, Map.of()).andReturn().getResponse().getStatus());
            var statuses = new ArrayList<Integer>();
            for (var f : pool.invokeAll(calls, 30, TimeUnit.SECONDS)) statuses.add(f.get());
            // The second identical webhook is throttled (503, not processed) unless it comes after the order is PAID.
            assertThat(statuses).as("" + statuses).allMatch(s -> s == 200 || s == 503);
            assertThat(statuses.stream().filter(s -> s == 200).count()).as("" + statuses).isGreaterThanOrEqualTo(3);
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.payment_transactions WHERE status = 'SUCCEEDED'", Long.class))
                .isEqualTo(1);
        assertThat(enrollments()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.orders", String.class)).isEqualTo("PAID");
    }

    // ------------------------------------------------------------------ helpers

    static final String WEBHOOK = "/api/v1/payments/payos/webhook";
    static final String CHECKSUM = "checksum-key-test";

    @BeforeEach
    void webhookKey() {
        org.springframework.test.util.ReflectionTestUtils.setField(payos, "checksumKey", CHECKSUM);
        doReturn(Optional.empty()).when(payos).lookup(anyLong());
    }

    void paysOnPayos(long no, String status, long paid) {
        doReturn(Optional.of(new PayosClient.Payment("link_1", no, status, 199_000L, paid))).when(payos).lookup(no);
    }

    /** A webhook body signed the way payOS does: data keys sorted, {@code key=value} joined by {@code &}. */
    static String signed(long no, String link, long amount) {
        String canonical = "amount=" + amount + "&description=TV&orderCode=" + no + "&paymentLinkId=" + link + "&reference=FT1";
        return "{\"code\":\"00\",\"desc\":\"success\",\"success\":true,\"data\":{\"orderCode\":" + no + ",\"amount\":" + amount
                + ",\"description\":\"TV\",\"reference\":\"FT1\",\"paymentLinkId\":\"" + link + "\"},\"signature\":\""
                + PayosClientTest.hmac(CHECKSUM, canonical) + "\"}";
    }

    ResultActions webhook(String body) throws Exception {
        return mvc.perform(post(WEBHOOK).contentType(org.springframework.http.MediaType.APPLICATION_JSON).content(body));
    }

    ResultActions sync(String code, String token) throws Exception {
        return send(post(ORDERS + "/" + code + "/sync"), token, Map.of());
    }

    String userEmail(String email) {
        user(email, null);
        return email;
    }

    long enrollments() {
        return jdbc.queryForObject("SELECT count(*) FROM techverse.course_enrollments", Long.class);
    }

    ResultActions buy(String courseId) throws Exception {
        return send(post(ORDERS), learnerToken, Map.of("courseId", courseId));
    }

    JsonNode detail(String code) throws Exception {
        return data(get(ORDERS + "/" + code, learnerToken).andExpect(status().isOk()));
    }

    /** Simulated clock: the last link request happened this many seconds ago. */
    void age(String code, int seconds) {
        jdbc.update("UPDATE techverse.orders SET payos_link_requested_at = clock_timestamp() - make_interval(secs => ?)"
                + " WHERE order_code = ?", seconds, code);
    }

    String link(String code) {
        return jdbc.queryForObject("SELECT payos_payment_link_id FROM techverse.orders WHERE order_code = ?", String.class, code);
    }
}
