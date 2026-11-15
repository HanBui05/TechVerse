package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import java.util.*;
import java.util.concurrent.*;

/** Admin confirms manual transfers, reconciles duplicate payments; Authors read their revenue. */
class PaymentConfirmationIntegrationTest extends CourseIntegrationTestBase {
    static final String ADMIN_ORDERS = "/api/v1/admin/orders";
    static final String REVENUE = "/api/v1/author/revenue";

    String paid;
    UUID admin;
    @org.springframework.beans.factory.annotation.Autowired javax.sql.DataSource dataSource;

    @BeforeEach
    void paymentSetup() throws Exception {
        // TRUNCATE users CASCADE also empties commission_policies.
        jdbc.update("INSERT INTO techverse.commission_policies (rate_bps) VALUES (2000)");
        paid = publishedPaidCourse("Paid course", 199_000);
        admin = jdbc.queryForObject("SELECT id FROM techverse.users WHERE email = 'admin@example.com'", UUID.class);
    }

    @Test
    void confirmingAPendingOrderRecordsTheAuditPaysTheOrderAndGrantsAccess() throws Exception {
        String code = buy(learnerToken);
        var order = data(confirm(code, 199_000, "  FT2611150001  ").andExpect(status().isOk()));
        assertThat(order.path("status").asText()).isEqualTo("PAID");
        assertThat(order.path("needsReconciliation").asBoolean()).isFalse();
        assertThat(order.path("buyerEmail").asText()).isEqualTo("learner@example.com");
        assertThat(order.at("/payments/0/reference").asText()).isEqualTo("FT2611150001");
        assertThat(order.at("/payments/0/amount").asLong()).isEqualTo(199_000);
        assertThat(order.path("payments").size()).isEqualTo(1);

        var tx = jdbc.queryForMap("SELECT status, provider_transaction_id, confirmed_by, confirmation_source, confirmed_at, paid_at"
                + " FROM techverse.payment_transactions");
        assertThat(tx).containsEntry("status", "SUCCEEDED").containsEntry("provider_transaction_id", "FT2611150001")
                .containsEntry("confirmed_by", admin).containsEntry("confirmation_source", "ADMIN");
        assertThat(tx.get("confirmed_at")).isNotNull();
        assertThat(activeEnrollments()).isEqualTo(1);
        String a2 = data(get(PUBLIC + "/" + paid, null)).at("/chapters/0/lessons/1/id").asText();
        get(PUBLIC + "/" + paid + "/lessons/" + a2, learnerToken).andExpect(status().isOk());
        get(ORDERS + "/" + code, learnerToken).andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.vietQr").doesNotExist());
    }

    @Test
    void retriesAndConcurrentConfirmationsWithTheSameReferenceChangeStateOnce() throws Exception {
        String code = buy(learnerToken);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> call = () -> confirm(code, 199_000, "FT1").andReturn().getResponse().getStatus();
            var a = pool.submit(call);
            var b = pool.submit(call);
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsOnly(200);
        } finally {
            pool.shutdownNow();
        }
        confirm(code, 199_000, "FT1").andExpect(status().isOk()).andExpect(jsonPath("$.data.needsReconciliation").value(false));
        assertThat(succeeded()).isEqualTo(1);
        assertThat(activeEnrollments()).isEqualTo(1);
    }

    @Test
    void aWrongAmountChangesNothing() throws Exception {
        String code = buy(learnerToken);
        confirm(code, 190_000, "FT1").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_AMOUNT_MISMATCH"));
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.orders", String.class)).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.payment_transactions", String.class)).isEqualTo("PENDING");
        assertThat(activeEnrollments()).isZero();
    }

    @Test
    void rejectsInvalidConfirmationBodies() throws Exception {
        String code = buy(learnerToken);
        for (Map<String, ?> body : List.<Map<String, ?>>of(
                Map.of(), Map.of("amount", 199_000), Map.of("bankReference", "FT1"),
                Map.of("amount", 0, "bankReference", "FT1"), Map.of("amount", -1, "bankReference", "FT1"),
                Map.of("amount", 199_000.5, "bankReference", "FT1"), Map.of("amount", "199000", "bankReference", "FT1"),
                Map.of("amount", 199_000, "bankReference", "   "), Map.of("amount", 199_000, "bankReference", "x".repeat(256)),
                Map.of("amount", 199_000, "bankReference", 12),
                Map.of("amount", 199_000, "bankReference", "FT1", "status", "PAID")))
            send(post(ADMIN_ORDERS + "/" + code + "/confirm"), adminToken, body)
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYMENT_INVALID"));
        confirm(code, 199_000, "x".repeat(255)).andExpect(status().isOk());
    }

    @Test
    void anExpiredOrderIsConfirmed() throws Exception {
        String code = buy(learnerToken);
        expire(code);
        get(ORDERS + "/" + code, learnerToken).andExpect(jsonPath("$.data.status").value("EXPIRED"));
        confirm(code, 199_000, "FT1").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.needsReconciliation").value(false));
        assertThat(activeEnrollments()).isEqualTo(1);
    }

    @Test
    void anOldOrderPaidAfterTheNewOneKeepsOneEnrollmentAndFlagsReconciliation() throws Exception {
        String old = buy(learnerToken);
        expire(old);
        String fresh = buy(learnerToken);
        confirm(fresh, 199_000, "FT-NEW").andExpect(jsonPath("$.data.needsReconciliation").value(false));
        confirm(old, 199_000, "FT-OLD").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.needsReconciliation").value(true));
        assertThat(activeEnrollments()).isEqualTo(1);
        assertThat(succeeded()).isEqualTo(2);
    }

    @Test
    void anOldOrderPaidBeforeTheNewOneGrantsAccessAndTheNewOneIsFlagged() throws Exception {
        String old = buy(learnerToken);
        expire(old);
        String fresh = buy(learnerToken);
        confirm(old, 199_000, "FT-OLD").andExpect(jsonPath("$.data.needsReconciliation").value(false));
        assertThat(activeEnrollments()).isEqualTo(1);
        confirm(fresh, 199_000, "FT-NEW").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.needsReconciliation").value(true));
        assertThat(activeEnrollments()).isEqualTo(1);
    }

    @Test
    void twoOrdersOfTheSameLearnerConfirmedConcurrentlyKeepOneEnrollment() throws Exception {
        String old = buy(learnerToken);
        expire(old);
        String fresh = buy(learnerToken);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var a = pool.submit(() -> confirm(old, 199_000, "FT-A").andReturn().getResponse().getStatus());
            var b = pool.submit(() -> confirm(fresh, 199_000, "FT-B").andReturn().getResponse().getStatus());
            assertThat(List.of(a.get(20, TimeUnit.SECONDS), b.get(20, TimeUnit.SECONDS))).containsOnly(200);
        } finally {
            pool.shutdownNow();
        }
        assertThat(activeEnrollments()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.orders WHERE status = 'PAID'", Long.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.orders WHERE needs_reconciliation", Long.class)).isEqualTo(1);
    }

    @Test
    void aReferenceUsedForAnotherOrderIsRejected() throws Exception {
        String first = buy(learnerToken);
        user("other@example.com", null);
        String second = buy(login("other@example.com"));
        confirm(first, 199_000, "FT1").andExpect(status().isOk());
        confirm(second, 199_000, "FT1").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_REFERENCE_CONFLICT"));
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.orders WHERE order_code = ?", String.class, second))
                .isEqualTo("PENDING");
    }

    @Test
    void aReferenceCommittedConcurrentlyForAnotherBuyerIsAConflict() throws Exception {
        String first = buy(learnerToken);
        user("other@example.com", null);
        String second = buy(login("other@example.com"));
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            // Uncommitted: the request passes the reference lookup and then waits on the unique index.
            try (var insert = connection.prepareStatement("INSERT INTO techverse.payment_transactions"
                    + " (order_id, provider, provider_transaction_id, amount, status)"
                    + " SELECT id, 'MANUAL', 'FT-RACE', total_amount, 'SUCCEEDED' FROM techverse.orders WHERE order_code = ?")) {
                insert.setString(1, first);
                insert.executeUpdate();
            }
            var pending = CompletableFuture.supplyAsync(() -> {
                try {
                    return confirm(second, 199_000, "FT-RACE").andReturn().getResponse().getContentAsString();
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            Thread.sleep(1500);
            assertThat(pending).isNotDone();
            connection.commit();
            assertThat(pending.get(10, TimeUnit.SECONDS)).contains("PAYMENT_REFERENCE_CONFLICT");
        }
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.orders WHERE order_code = ?", String.class, second))
                .isEqualTo("PENDING");
        assertThat(succeeded()).isEqualTo(1);
        assertThat(activeEnrollments()).isEqualTo(1);
    }

    @Test
    void aNewReferenceOnAPaidOrderIsRecordedFlaggedAndReconciled() throws Exception {
        String code = buy(learnerToken);
        confirm(code, 199_000, "FT1").andExpect(status().isOk());
        reconcile(code, 1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_RECONCILIATION_NOT_REQUIRED"));
        confirm(code, 190_000, "FT2").andExpect(jsonPath("$.code").value("PAYMENT_AMOUNT_MISMATCH"));

        var dup = data(confirm(code, 199_000, "FT2").andExpect(status().isOk()));
        assertThat(dup.path("needsReconciliation").asBoolean()).isTrue();
        assertThat(dup.path("payments").size()).isEqualTo(2);
        assertThat(succeeded()).isEqualTo(2);
        assertThat(activeEnrollments()).isEqualTo(1);
        get(REVENUE, authorToken).andExpect(jsonPath("$.data.totals.itemCount").value(1))
                .andExpect(jsonPath("$.data.totals.grossAmount").value(199_000));

        for (Map<String, ?> body : List.<Map<String, ?>>of(Map.of(), Map.of("paymentCount", 0), Map.of("paymentCount", "2"),
                Map.of("paymentCount", 2, "note", "x")))
            send(post(ADMIN_ORDERS + "/" + code + "/reconcile"), adminToken, body)
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYMENT_INVALID"));
        reconcile(code, 1).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_RECONCILIATION_STALE"));
        var closed = data(reconcile(code, 2).andExpect(status().isOk()));
        assertThat(closed.path("needsReconciliation").asBoolean()).isFalse();
        assertThat(closed.path("reconciledAt").asText()).isNotBlank().isNotEqualTo("null");
        reconcile(code, 2).andExpect(status().isOk()).andExpect(jsonPath("$.data.needsReconciliation").value(false));
        assertThat(jdbc.queryForObject("SELECT reconciled_by FROM techverse.orders", UUID.class)).isEqualTo(admin);

        confirm(code, 199_000, "FT3").andExpect(jsonPath("$.data.needsReconciliation").value(true));
        assertThat(activeEnrollments()).isEqualTo(1);
        // A delayed retry of the earlier close must not hide the new payment.
        reconcile(code, 2).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYMENT_RECONCILIATION_STALE"));
        assertThat(jdbc.queryForObject("SELECT needs_reconciliation FROM techverse.orders", Boolean.class)).isTrue();
        reconcile(code, 3).andExpect(jsonPath("$.data.needsReconciliation").value(false));
    }

    @Test
    void onlyManualPendingExpiredOrPaidOrdersCanBeConfirmed() throws Exception {
        String code = buy(learnerToken);
        jdbc.update("UPDATE techverse.payment_transactions SET status = 'CANCELLED'");
        jdbc.update("UPDATE techverse.orders SET status = 'CANCELLED'");
        confirm(code, 199_000, "FT1").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_STATE_INVALID"));
        confirm("TV999999999999", 199_000, "FT1").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
        reconcile("TV999999999999", 1).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
    }

    @Test
    void onlyAdminsManageOrders() throws Exception {
        String code = buy(learnerToken);
        get(ADMIN_ORDERS, null).andExpect(status().isUnauthorized());
        confirm(code, 199_000, null).andExpect(status().isUnauthorized());
        for (String token : new String[] {learnerToken, authorToken, modToken}) {
            get(ADMIN_ORDERS, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            send(post(ADMIN_ORDERS + "/" + code + "/confirm"), token, Map.of("amount", 199_000, "bankReference", "FT1"))
                    .andExpect(status().isForbidden());
            send(post(ADMIN_ORDERS + "/" + code + "/reconcile"), token, Map.of()).andExpect(status().isForbidden());
        }
        assertThat(succeeded()).isZero();
    }

    @Test
    void adminListFiltersByStatusCodeTransferReportAndReconciliation() throws Exception {
        String reported = buy(learnerToken);
        send(post(ORDERS + "/" + reported + "/transfer-report"), learnerToken, Map.of()).andExpect(status().isOk());
        user("other@example.com", null);
        String otherToken = login("other@example.com");
        String paidCode = buy(otherToken);
        confirm(paidCode, 199_000, "FT1");
        confirm(paidCode, 199_000, "FT2");

        var all = data(get(ADMIN_ORDERS + "?page=0&size=1", adminToken).andExpect(status().isOk()));
        assertThat(all.path("totalElements").asLong()).isEqualTo(2);
        assertThat(all.path("content").size()).isEqualTo(1);
        assertThat(all.at("/content/0/orderCode").asText()).isEqualTo(paidCode);
        assertThat(all.at("/content/0/courseTitle").asText()).isEqualTo("Paid course");

        assertCodes("?status=PENDING", reported);
        assertCodes("?status=PAID", paidCode);
        assertCodes("?code=" + reported.toLowerCase(), reported);
        assertCodes("?transferReported=true", reported);
        assertCodes("?transferReported=false", paidCode);
        assertCodes("?needsReconciliation=true", paidCode);
        assertCodes("?needsReconciliation=false", reported);
        assertCodes("?status=PAID&needsReconciliation=false");
        get(ADMIN_ORDERS + "?status=NOPE", adminToken).andExpect(status().isBadRequest());
        get(ADMIN_ORDERS + "?size=101", adminToken).andExpect(status().isBadRequest());
    }

    @Test
    void authorRevenueListsOnlyPaidItemsOfTheirCoursesWithoutBuyerData() throws Exception {
        String first = buy(learnerToken);
        confirm(first, 199_000, "FT1");
        user("other@example.com", null);
        String otherToken = login("other@example.com");
        String second = buy(otherToken);
        confirm(second, 199_000, "FT2");
        user("third@example.com", null);
        buy(login("third@example.com")); // pending: not revenue

        var revenue = data(get(REVENUE + "?page=0&size=1", authorToken).andExpect(status().isOk()));
        var totals = revenue.path("totals");
        assertThat(totals.path("itemCount").asLong()).isEqualTo(2);
        assertThat(totals.path("grossAmount").asLong()).isEqualTo(398_000);
        assertThat(totals.path("platformAmount").asLong()).isEqualTo(79_600);
        assertThat(totals.path("authorAmount").asLong()).isEqualTo(318_400);
        var items = revenue.path("items");
        assertThat(items.path("totalElements").asLong()).isEqualTo(2);
        assertThat(items.path("content").size()).isEqualTo(1);
        var item = items.at("/content/0");
        assertThat(item.path("courseId").asText()).isEqualTo(paid);
        assertThat(item.path("courseTitle").asText()).isEqualTo("Paid course");
        assertThat(item.path("unitPriceAmount").asLong()).isEqualTo(199_000);
        assertThat(item.path("commissionRateBps").asInt()).isEqualTo(2000);
        assertThat(item.path("commissionAmount").asLong()).isEqualTo(39_800);
        assertThat(item.path("authorNetAmount").asLong()).isEqualTo(159_200);
        assertThat(item.path("paidAt").asText()).isNotBlank();
        assertThat(revenue.toString()).doesNotContain("example.com", "userId", "buyer", "orderCode", "TV0");

        // Snapshot: a later policy change does not rewrite paid items.
        send(put(POLICY), adminToken, Map.of("rateBps", 3000)).andExpect(status().isOk());
        get(REVENUE, authorToken).andExpect(jsonPath("$.data.totals.platformAmount").value(79_600));

        user("author2@example.com", "AUTHOR");
        var isolated = data(get(REVENUE, login("author2@example.com")).andExpect(status().isOk()));
        assertThat(isolated.path("totals").path("itemCount").asLong()).isZero();
        assertThat(isolated.path("totals").path("grossAmount").asLong()).isZero();
        assertThat(isolated.path("items").path("totalElements").asLong()).isZero();

        get(REVENUE, null).andExpect(status().isUnauthorized());
        for (String token : new String[] {learnerToken, modToken, adminToken})
            get(REVENUE, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ------------------------------------------------------------------ commission policy

    @Test
    void adminChangesTheRateAtOnceKeepingHistoryAndOldSnapshots() throws Exception {
        get(POLICY, adminToken).andExpect(status().isOk()).andExpect(jsonPath("$.data.rateBps").value(2000));
        String oldOrder = buy(learnerToken);

        var changed = send(put(POLICY), adminToken, Map.of("rateBps", 3333)).andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Commission rate updated"));
        var policy = data(changed);
        assertThat(policy.path("rateBps").asInt()).isEqualTo(3333);
        assertThat(policy.path("effectiveFrom").asText()).isNotBlank();
        // Same rate: no new row.
        send(put(POLICY), adminToken, Map.of("rateBps", 3333)).andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Commission rate unchanged"))
                .andExpect(jsonPath("$.data.id").value(policy.path("id").asText()));
        get(POLICY, adminToken).andExpect(jsonPath("$.data.id").value(policy.path("id").asText()));

        var rows = jdbc.queryForList("SELECT rate_bps, is_active, effective_from, effective_to, created_by"
                + " FROM techverse.commission_policies ORDER BY effective_from");
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0)).containsEntry("rate_bps", 2000).containsEntry("is_active", false);
        assertThat(rows.get(0).get("effective_to")).isEqualTo(rows.get(1).get("effective_from"));
        assertThat(rows.get(1)).containsEntry("rate_bps", 3333).containsEntry("is_active", true)
                .containsEntry("effective_to", null).containsEntry("created_by", admin);

        user("other@example.com", null);
        String newOrder = buy(login("other@example.com"));
        // floor(199000 × 3333 / 10000) = floor(66326.7)
        assertThat(item(newOrder)).containsEntry("commission_rate_bps", 3333)
                .containsEntry("commission_amount", 66_326L).containsEntry("author_net_amount", 132_674L);
        assertThat(item(oldOrder)).containsEntry("commission_rate_bps", 2000).containsEntry("commission_amount", 39_800L);
        get(AUTHOR + "/" + paid, authorToken).andExpect(jsonPath("$.data.commissionRateBps").value(3333));

        send(put(POLICY), adminToken, Map.of("rateBps", 0)).andExpect(jsonPath("$.data.rateBps").value(0));
        send(put(POLICY), adminToken, Map.of("rateBps", 10000)).andExpect(jsonPath("$.data.rateBps").value(10000));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.commission_policies WHERE is_active", Long.class)).isEqualTo(1);
    }

    @Test
    void rejectsInvalidRates() throws Exception {
        for (Map<String, ?> body : List.<Map<String, ?>>of(Map.of(),Map.of("rateBps", -1), Map.of("rateBps", 10001), Map.of("rateBps", "1500"),
                Map.of("rateBps", 15.5), Map.of("rateBps", 5_000_000_000L), Map.of("rateBps", 1500, "effectiveFrom", "2030-01-01T00:00:00Z")))
            send(put(POLICY), adminToken, body).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("COMMISSION_RATE_INVALID"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.commission_policies", Long.class)).isEqualTo(1);
    }

    @Test
    void onlyAdminsManageTheCommissionPolicy() throws Exception {
        get(POLICY, null).andExpect(status().isUnauthorized());
        send(put(POLICY), null, Map.of("rateBps", 1000)).andExpect(status().isUnauthorized());
        for (String token : new String[] {learnerToken, authorToken, modToken}) {
            get(POLICY, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            send(put(POLICY), token, Map.of("rateBps", 1000)).andExpect(status().isForbidden());
        }
        assertThat(jdbc.queryForObject("SELECT rate_bps FROM techverse.commission_policies WHERE is_active", Integer.class))
                .isEqualTo(2000);
    }

    @Test
    void withoutAPolicyTheAdminSeesNoneAndCanSetOne() throws Exception {
        jdbc.update("UPDATE techverse.commission_policies SET is_active = false, effective_to = clock_timestamp()");
        get(POLICY, adminToken).andExpect(status().isOk()).andExpect(jsonPath("$.data").doesNotExist());
        send(post(ORDERS), learnerToken, Map.of("courseId", paid)).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PAYMENT_UNAVAILABLE"));
        send(put(POLICY), adminToken, Map.of("rateBps", 1000)).andExpect(jsonPath("$.data.rateBps").value(1000));
        assertThat(item(buy(learnerToken))).containsEntry("commission_rate_bps", 1000);
    }

    @Test
    void concurrentChangesLeaveOneActivePolicyAndAnUnbrokenHistory() throws Exception {
        var pool = Executors.newFixedThreadPool(4);
        try {
            var calls = new ArrayList<Future<Integer>>();
            for (int rate : new int[] {1000, 1500, 2500, 3000})
                calls.add(pool.submit(() -> send(put(POLICY), adminToken, Map.of("rateBps", rate)).andReturn().getResponse().getStatus()));
            for (var call : calls) assertThat(call.get(20, TimeUnit.SECONDS)).isEqualTo(200);
        } finally {
            pool.shutdownNow();
        }
        var rows = jdbc.queryForList("SELECT is_active, effective_from, effective_to FROM techverse.commission_policies"
                + " ORDER BY effective_from");
        assertThat(rows).hasSize(5);
        assertThat(rows.stream().filter(r -> (Boolean) r.get("is_active")).count()).isEqualTo(1);
        for (int i = 0; i < rows.size() - 1; i++)
            assertThat(rows.get(i).get("effective_to")).isEqualTo(rows.get(i + 1).get("effective_from"));
    }

    @Test
    void anOrderCreatedDuringAPolicyChangeWaitsAndTakesTheNewRate() throws Exception {
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            // A policy change in progress holds the commission lock; the order's transaction starts meanwhile.
            try (var change = connection.createStatement()) {
                change.execute("SELECT pg_advisory_xact_lock(" + com.techverse.server.repository.OrderRepository.COMMISSION_LOCK + ")");
                var pending = CompletableFuture.supplyAsync(() -> {
                    try {
                        return buy(learnerToken);
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                });
                Thread.sleep(1500);
                assertThat(pending).isNotDone();
                change.execute("UPDATE techverse.commission_policies SET is_active = false, effective_to = clock_timestamp()");
                change.execute("INSERT INTO techverse.commission_policies (rate_bps, effective_from) VALUES (1000, clock_timestamp())");
                connection.commit();
                String code = pending.get(10, TimeUnit.SECONDS);
                assertThat(item(code)).containsEntry("commission_rate_bps", 1000);
                // The order's own timestamps must not predate the policy it snapshots.
                assertThat(jdbc.queryForObject("SELECT o.created_at >= p.effective_from AND i.created_at >= p.effective_from"
                        + " FROM techverse.orders o JOIN techverse.order_items i ON i.order_id = o.id"
                        + " JOIN techverse.commission_policies p ON p.id = i.commission_policy_id WHERE o.order_code = ?",
                        Boolean.class, code)).isTrue();
            }
        }
    }

    @Test
    void aPolicyChangeWaitsForAnOrderBeingCreated() throws Exception {
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try (var lock = connection.createStatement()) {
                lock.execute("SELECT pg_advisory_xact_lock(" + com.techverse.server.repository.OrderRepository.COMMISSION_LOCK + ")");
            }
            var pending = CompletableFuture.supplyAsync(() -> {
                try {
                    return send(put(POLICY), adminToken, Map.of("rateBps", 1000)).andReturn().getResponse().getStatus();
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            Thread.sleep(1500);
            assertThat(pending).isNotDone();
            connection.commit();
            assertThat(pending.get(10, TimeUnit.SECONDS)).isEqualTo(200);
        }
    }

    @Test
    void policyAndItemSnapshotsCannotBeRewritten() throws Exception {
        String code = buy(learnerToken);
        for (String sql : List.of(
                "UPDATE techverse.commission_policies SET rate_bps = 100",
                "UPDATE techverse.commission_policies SET effective_from = now() - interval '1 day'",
                "UPDATE techverse.order_items SET commission_amount = 0, author_net_amount = unit_price_amount",
                "UPDATE techverse.order_items SET unit_price_amount = 10000",
                "UPDATE techverse.order_items SET commission_rate_bps = 0"))
            assertThatThrownBy(() -> jdbc.update(sql)).as(sql).hasMessageContaining("immutable");
        // A closed policy cannot be reopened or re-dated; an item cannot move to another policy.
        send(put(POLICY), adminToken, Map.of("rateBps", 1000)).andExpect(status().isOk());
        assertThatThrownBy(() -> jdbc.update("UPDATE techverse.order_items SET commission_policy_id ="
                + " (SELECT id FROM techverse.commission_policies WHERE is_active)")).hasMessageContaining("immutable");
        assertThatThrownBy(() -> jdbc.update("UPDATE techverse.commission_policies SET is_active = true WHERE NOT is_active"))
                .hasMessageContaining("immutable");
        assertThatThrownBy(() -> jdbc.update("UPDATE techverse.commission_policies SET effective_to = now() + interval '1 day'"
                + " WHERE NOT is_active")).hasMessageContaining("immutable");
        // Other columns stay updatable.
        jdbc.update("UPDATE techverse.order_items SET updated_by = ?", admin);
        assertThat(item(code)).containsEntry("commission_rate_bps", 2000).containsEntry("commission_amount", 39_800L)
                .containsEntry("unit_price_amount", 199_000L);
    }

    // ------------------------------------------------------------------ helpers

    static final String POLICY = "/api/v1/admin/commission-policy";

    Map<String, Object> item(String code) {
        return jdbc.queryForMap("SELECT i.unit_price_amount, i.commission_rate_bps, i.commission_amount, i.author_net_amount"
                + " FROM techverse.order_items i JOIN techverse.orders o ON o.id = i.order_id WHERE o.order_code = ?", code);
    }

    static final String ORDERS = "/api/v1/orders";

    String buy(String token) throws Exception {
        return data(send(post(ORDERS), token, Map.of("courseId", paid)).andExpect(status().isOk())).path("orderCode").asText();
    }

    ResultActions confirm(String code, long amount, String reference) throws Exception {
        return send(post(ADMIN_ORDERS + "/" + code + "/confirm"), reference == null ? null : adminToken,
                Map.of("amount", amount, "bankReference", reference == null ? "FT" : reference));
    }

    ResultActions reconcile(String code, int paymentCount) throws Exception {
        return send(post(ADMIN_ORDERS + "/" + code + "/reconcile"), adminToken, Map.of("paymentCount", paymentCount));
    }

    void assertCodes(String query, String... codes) throws Exception {
        var page = data(get(ADMIN_ORDERS + query, adminToken).andExpect(status().isOk()));
        var found = new ArrayList<String>();
        page.path("content").forEach(o -> found.add(o.path("orderCode").asText()));
        assertThat(found).as(query).containsExactlyInAnyOrder(codes);
    }

    void expire(String code) {
        jdbc.update("UPDATE techverse.orders SET expires_at = now() - interval '1 minute' WHERE order_code = ?", code);
    }

    long activeEnrollments() {
        return jdbc.queryForObject("SELECT count(*) FROM techverse.course_enrollments WHERE revoked_at IS NULL", Long.class);
    }

    long succeeded() {
        return jdbc.queryForObject("SELECT count(*) FROM techverse.payment_transactions WHERE status = 'SUCCEEDED'", Long.class);
    }
}
