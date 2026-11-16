package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;

/** Author's receiving account, balance and payout history (payouts are inserted directly until the Admin flow exists). */
class AuthorPayoutIntegrationTest extends CourseIntegrationTestBase {
    static final String ACCOUNT = "/api/v1/author/payout-account";
    static final String PAYOUTS = "/api/v1/author/payouts";
    static final String REVENUE = "/api/v1/author/revenue";

    UUID admin;

    @BeforeEach
    void payoutSetup() {
        // TRUNCATE users CASCADE also empties commission_policies.
        jdbc.update("INSERT INTO techverse.commission_policies (rate_bps) VALUES (2000)");
        admin = jdbc.queryForObject("SELECT id FROM techverse.users WHERE email = 'admin@example.com'", UUID.class);
    }

    @Test
    void anAuthorDeclaresThenReplacesTheAccountFromTheSupportedBanks() throws Exception {
        var empty = data(get(ACCOUNT, authorToken).andExpect(status().isOk()));
        assertThat(empty.path("account").isNull()).isTrue();
        assertThat(empty.path("banks").size()).isGreaterThanOrEqualTo(20);
        assertThat(empty.toString()).contains("\"id\":\"970436\"", "Vietcombank");

        var saved = data(send(put(ACCOUNT), authorToken,
                Map.of("bankId", "970436", "accountNo", " 0123456789 ", "accountName", " Nguyễn Văn A "))
                .andExpect(status().isOk())).path("account");
        assertThat(saved.path("bankId").asText()).isEqualTo("970436");
        assertThat(saved.path("bankName").asText()).isEqualTo("Vietcombank");
        assertThat(saved.path("accountNo").asText()).isEqualTo("0123456789");
        assertThat(saved.path("accountName").asText()).isEqualTo("NGUYỄN VĂN A");

        send(put(ACCOUNT), authorToken, Map.of("bankId", "970422", "accountNo", "9988776655", "accountName", "B"))
                .andExpect(status().isOk());
        var replaced = data(get(ACCOUNT, authorToken)).path("account");
        assertThat(replaced.path("bankId").asText()).isEqualTo("970422");
        assertThat(replaced.path("accountNo").asText()).isEqualTo("9988776655");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.author_payout_accounts", Long.class)).isEqualTo(1);

        send(put(ACCOUNT), authorToken, Map.of("bankId", "000000", "accountNo", "9988776655", "accountName", "B"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYOUT_ACCOUNT_INVALID"));
    }

    @Test
    void concurrentSavesKeepOneRow() throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        try {
            var calls = new ArrayList<Future<Integer>>();
            for (String no : new String[] {"1111111111", "2222222222"})
                calls.add(pool.submit(() -> send(put(ACCOUNT), authorToken,
                        Map.of("bankId", "970436", "accountNo", no, "accountName", "A")).andReturn().getResponse().getStatus()));
            for (var call : calls) assertThat(call.get(30, TimeUnit.SECONDS)).isEqualTo(200);
        } finally {
            pool.shutdown();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.author_payout_accounts", Long.class)).isEqualTo(1);
    }

    @Test
    void onlyTheOwningAuthorReadsTheAccountAndNewRoutesNeedAToken() throws Exception {
        send(put(ACCOUNT), authorToken, Map.of("bankId", "970436", "accountNo", "0123456789", "accountName", "A"))
                .andExpect(status().isOk());
        user("author2@example.com", "AUTHOR");
        var other = data(get(ACCOUNT, login("author2@example.com")).andExpect(status().isOk()));
        assertThat(other.path("account").isNull()).isTrue();

        for (String token : new String[] {learnerToken, modToken, adminToken}) {
            get(ACCOUNT, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            get(PAYOUTS, token).andExpect(status().isForbidden());
            send(put(ACCOUNT), token, Map.of("bankId", "970436", "accountNo", "0123456789", "accountName", "A"))
                    .andExpect(status().isForbidden());
        }
        get(ACCOUNT, null).andExpect(status().isUnauthorized());
        get(PAYOUTS, null).andExpect(status().isUnauthorized());
        send(put(ACCOUNT), null, Map.of("bankId", "970436", "accountNo", "0123456789", "accountName", "A"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void balanceIsEarnedMinusPaidOutAndPayoutsListOnlyTheAuthorsOwnMasked() throws Exception {
        String paid = publishedPaidCourse("Paid course", 199_000);
        String code = data(send(post("/api/v1/orders"), learnerToken, Map.of("courseId", paid)).andExpect(status().isOk()))
                .path("orderCode").asText();
        send(post("/api/v1/admin/orders/" + code + "/confirm"), adminToken, Map.of("amount", 199_000, "bankReference", "FT1"))
                .andExpect(status().isOk());

        var before = data(get(REVENUE, authorToken).andExpect(status().isOk())).path("totals");
        assertThat(before.path("authorAmount").asLong()).isEqualTo(159_200);
        assertThat(before.path("paidOutAmount").asLong()).isZero();
        assertThat(before.path("balanceAmount").asLong()).isEqualTo(159_200);

        payout(author, 100_000, "CHI-1", "0123456789");
        payout(author, 9_200, "CHI-2", "AB1234");
        UUID author2 = user("author2@example.com", "AUTHOR");
        payout(author2, 5_000, "CHI-OTHER", "5555555555");

        var after = data(get(REVENUE, authorToken)).path("totals");
        assertThat(after.path("authorAmount").asLong()).isEqualTo(159_200);
        assertThat(after.path("paidOutAmount").asLong()).isEqualTo(109_200);
        assertThat(after.path("balanceAmount").asLong()).isEqualTo(50_000);

        var page = data(get(PAYOUTS + "?page=0&size=1", authorToken).andExpect(status().isOk()));
        assertThat(page.path("totalElements").asLong()).isEqualTo(2);
        var newest = page.at("/content/0");
        assertThat(newest.path("amount").asLong()).isEqualTo(9_200);
        assertThat(newest.path("bankReference").asText()).isEqualTo("CHI-2");
        assertThat(newest.path("accountNo").asText()).isEqualTo("****1234");
        assertThat(newest.path("createdAt").asText()).isNotBlank();
        assertThat(data(get(PAYOUTS + "?page=1&size=1", authorToken)).at("/content/0/accountNo").asText()).isEqualTo("****6789");
        assertThat(page.toString()).doesNotContain("0123456789", "CHI-OTHER");
    }

    void payout(UUID to, long amount, String ref, String accountNo) {
        // Distinct created_at so "newest first" is deterministic.
        jdbc.update("INSERT INTO techverse.author_payouts(author_id, amount, bank_reference, bank_id, account_no, account_name, created_by, created_at)"
                + " VALUES (?,?,?,'970436',?,'A',?, clock_timestamp())", to, amount, ref, accountNo, admin);
    }
}
