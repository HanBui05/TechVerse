package com.techverse.server.course;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;

/** Author's receiving account, balance and payout history; Admin balances and payout recording, including races. */
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

    // ------------------------------------------------------------------ Admin: balances and recording payouts

    static final String ADMIN_AUTHORS = "/api/v1/admin/payouts/authors";
    static final String ADMIN_PAYOUTS = "/api/v1/admin/payouts";

    @Test
    void adminSeesTheBalanceWithAQrToTheAuthorAndRecordingAPayoutSettlesIt() throws Exception {
        sell("Paid course", 199_000, "FT1");
        var noAccount = data(get(ADMIN_AUTHORS, adminToken).andExpect(status().isOk())).at("/content/0");
        assertThat(noAccount.path("authorId").asText()).isEqualTo(author.toString());
        assertThat(noAccount.path("email").asText()).isEqualTo("author@example.com");
        assertThat(noAccount.path("earnedAmount").asLong()).isEqualTo(159_200);
        assertThat(noAccount.path("balanceAmount").asLong()).isEqualTo(159_200);
        assertThat(noAccount.path("account").isNull()).isTrue();
        assertThat(noAccount.path("vietQr").isNull()).isTrue();

        saveAccount("970436", "0123456789", "Nguyễn Văn A");
        String hex = author.toString().substring(0, 8).toUpperCase(Locale.ROOT);
        var owed = data(get(ADMIN_AUTHORS + "?owedOnly=true", adminToken)).at("/content/0");
        assertThat(owed.at("/account/accountNo").asText()).isEqualTo("0123456789");
        assertThat(owed.at("/vietQr/amount").asLong()).isEqualTo(159_200);
        assertThat(owed.at("/vietQr/content").asText()).isEqualTo("TVPAY" + hex);
        assertThat(owed.at("/vietQr/imageUrl").asText())
                .startsWith("https://img.vietqr.io/image/970436-0123456789-")
                .contains("amount=159200", "addInfo=TVPAY" + hex, "accountName=NGUY%E1%BB%84N%20V%C4%82N%20A");

        var body = payoutBody(author, 159_200, " CHI-1 ", "970436", "0123456789", "Nguyễn Văn A");
        var recorded = data(send(post(ADMIN_PAYOUTS), adminToken, body).andExpect(status().isOk()));
        assertThat(recorded.path("accountChanged").asBoolean()).isFalse();
        assertThat(recorded.path("bankReference").asText()).isEqualTo("CHI-1");
        assertThat(data(get(REVENUE, authorToken)).at("/totals/balanceAmount").asLong()).isZero();
        assertThat(data(get(PAYOUTS, authorToken)).at("/content/0/accountNo").asText()).isEqualTo("****6789");

        var history = data(get(ADMIN_PAYOUTS + "?authorId=" + author, adminToken).andExpect(status().isOk()));
        assertThat(history.path("totalElements").asLong()).isEqualTo(1);
        assertThat(history.at("/content/0/accountNo").asText()).isEqualTo("0123456789");
        assertThat(history.at("/content/0/accountName").asText()).isEqualTo("NGUYỄN VĂN A");
        assertThat(history.at("/content/0/recordedById").asText()).isEqualTo(admin.toString());
        assertThat(data(get(ADMIN_PAYOUTS, adminToken)).path("totalElements").asLong()).isEqualTo(1);
        assertThat(data(get(ADMIN_PAYOUTS + "?authorId=" + learner, adminToken)).path("totalElements").asLong()).isZero();

        assertThat(data(get(ADMIN_AUTHORS, adminToken)).path("totalElements").asLong()).isZero();
        var all = data(get(ADMIN_AUTHORS + "?owedOnly=false", adminToken)).at("/content/0");
        assertThat(all.path("paidOutAmount").asLong()).isEqualTo(159_200);
        assertThat(all.path("balanceAmount").asLong()).isZero();
        assertThat(all.path("vietQr").isNull()).isTrue();

        // A retry after the balance reached zero returns the recorded payout.
        var again = data(send(post(ADMIN_PAYOUTS), adminToken, body).andExpect(status().isOk()));
        assertThat(again.path("id").asText()).isEqualTo(recorded.path("id").asText());
        assertThat(payoutCount()).isEqualTo(1);
        send(post(ADMIN_PAYOUTS), adminToken, payoutBody(author, 1, "CHI-1", "970436", "0123456789", "A"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYOUT_REFERENCE_CONFLICT"));
        send(post(ADMIN_PAYOUTS), adminToken, payoutBody(author, 1, "CHI-2", "970436", "0123456789", "A"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PAYOUT_EXCEEDS_BALANCE"));
    }

    @Test
    void aPayoutToAnAccountTheAuthorChangedSinceIsRecordedAsSentAndBadInputIsRejected() throws Exception {
        sell("Paid course", 199_000, "FT1");
        saveAccount("970436", "0123456789", "A");
        saveAccount("970422", "9988776655", "B");

        var recorded = data(send(post(ADMIN_PAYOUTS), adminToken,
                payoutBody(author, 100_000, "CHI-1", "970436", "0123456789", "A")).andExpect(status().isOk()));
        assertThat(recorded.path("accountChanged").asBoolean()).isTrue();
        assertThat(recorded.path("bankId").asText()).isEqualTo("970436");
        assertThat(recorded.path("accountNo").asText()).isEqualTo("0123456789");

        send(post(ADMIN_PAYOUTS), adminToken, payoutBody(UUID.randomUUID(), 1, "CHI-9", "970436", "0123456789", "A"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
        send(post(ADMIN_PAYOUTS), adminToken, payoutBody(author, 0, "CHI-9", "970436", "0123456789", "A"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYOUT_INVALID"));
        get(ADMIN_AUTHORS + "?owedOnly=maybe", adminToken)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYOUT_INVALID"));
        get(ADMIN_PAYOUTS + "?authorId=1-1-1-1-1", adminToken)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("PAYOUT_INVALID"));
    }

    @Test
    void adminPayoutRoutesAreAdminOnly() throws Exception {
        var body = payoutBody(author, 1, "CHI-1", "970436", "0123456789", "A");
        for (String token : new String[] {authorToken, modToken, learnerToken}) {
            get(ADMIN_AUTHORS, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            get(ADMIN_PAYOUTS, token).andExpect(status().isForbidden());
            send(post(ADMIN_PAYOUTS), token, body).andExpect(status().isForbidden());
        }
        get(ADMIN_AUTHORS, null).andExpect(status().isUnauthorized());
        get(ADMIN_PAYOUTS, null).andExpect(status().isUnauthorized());
        send(post(ADMIN_PAYOUTS), null, body).andExpect(status().isUnauthorized());
        assertThat(payoutCount()).isZero();
    }

    @Test
    void concurrentPayoutsNeverExceedTheBalanceAndIdenticalOnesRecordOnce() throws Exception {
        sell("Paid course", 199_000, "FT1"); // earned 159 200
        var split = parallel(
                payoutBody(author, 100_000, "CHI-A", "970436", "0123456789", "A"),
                payoutBody(author, 100_000, "CHI-B", "970436", "0123456789", "A"));
        assertThat(split).extracting(r -> r[0]).containsExactlyInAnyOrder("200", "409");
        assertThat(split).extracting(r -> r[1]).contains("PAYOUT_EXCEEDS_BALANCE");
        assertThat(payoutCount()).isEqualTo(1);

        var same = payoutBody(author, 50_000, "CHI-C", "970436", "0123456789", "A");
        assertThat(parallel(same, same)).extracting(r -> r[0]).containsExactly("200", "200");
        assertThat(payoutCount()).isEqualTo(2);
    }

    @Test
    void twoAuthorsRacingForOneReferenceGetOneSuccessAndOneConflict() throws Exception {
        sell("Paid course", 199_000, "FT1");
        UUID author2 = user("author2@example.com", "AUTHOR");
        String original = authorToken;
        authorToken = login("author2@example.com");
        sell("Second course", 99_000, "FT2");
        authorToken = original;

        var race = parallel(
                payoutBody(author, 10_000, "CHI-X", "970436", "0123456789", "A"),
                payoutBody(author2, 10_000, "CHI-X", "970436", "5555555555", "B"));
        assertThat(race).extracting(r -> r[0]).containsExactlyInAnyOrder("200", "409");
        assertThat(race).extracting(r -> r[1]).contains("PAYOUT_REFERENCE_CONFLICT");
        assertThat(payoutCount()).isEqualTo(1);
    }

    /** Publishes a paid course as {@code authorToken}, sells it to the learner and confirms the transfer. */
    void sell(String title, long price, String reference) throws Exception {
        String course = publishedPaidCourse(title, price);
        String code = data(send(post("/api/v1/orders"), learnerToken, Map.of("courseId", course)).andExpect(status().isOk()))
                .path("orderCode").asText();
        send(post("/api/v1/admin/orders/" + code + "/confirm"), adminToken, Map.of("amount", price, "bankReference", reference))
                .andExpect(status().isOk());
    }

    void saveAccount(String bankId, String accountNo, String accountName) throws Exception {
        send(put(ACCOUNT), authorToken, Map.of("bankId", bankId, "accountNo", accountNo, "accountName", accountName))
                .andExpect(status().isOk());
    }

    static Map<String, Object> payoutBody(UUID to, long amount, String ref, String bankId, String accountNo, String name) {
        return Map.of("authorId", to.toString(), "amount", amount, "bankReference", ref,
                "bankId", bankId, "accountNo", accountNo, "accountName", name);
    }

    long payoutCount() {
        return jdbc.queryForObject("SELECT count(*) FROM techverse.author_payouts", Long.class);
    }

    /** Sends both bodies at once; each result is {status, error code}. */
    List<String[]> parallel(Map<String, Object> first, Map<String, Object> second) throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            var calls = new ArrayList<Future<String[]>>();
            for (var body : List.of(first, second))
                calls.add(pool.submit(() -> {
                    start.await();
                    var response = send(post(ADMIN_PAYOUTS), adminToken, body).andReturn().getResponse();
                    return new String[] {String.valueOf(response.getStatus()),
                            mapper.readTree(response.getContentAsString()).path("code").asText()};
                }));
            start.countDown();
            var results = new ArrayList<String[]>();
            for (var call : calls) results.add(call.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            pool.shutdown();
        }
    }

    void payout(UUID to, long amount, String ref, String accountNo) {
        // Distinct created_at so "newest first" is deterministic.
        jdbc.update("INSERT INTO techverse.author_payouts(author_id, amount, bank_reference, bank_id, account_no, account_name, created_by, created_at)"
                + " VALUES (?,?,?,'970436',?,'A',?, clock_timestamp())", to, amount, ref, accountNo, admin);
    }
}
