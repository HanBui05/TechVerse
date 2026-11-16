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

    // ------------------------------------------------------------------ helpers

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
