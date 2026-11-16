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
    String sell(String title, long price, String reference) throws Exception {
        String course = publishedPaidCourse(title, price);
        String code = data(send(post("/api/v1/orders"), learnerToken, Map.of("courseId", course)).andExpect(status().isOk()))
                .path("orderCode").asText();
        send(post("/api/v1/admin/orders/" + code + "/confirm"), adminToken, Map.of("amount", price, "bankReference", reference))
                .andExpect(status().isOk());
        return course;
    }

    void paidAt(String course, String timestamp) {
        jdbc.update("UPDATE techverse.orders SET paid_at = ?::timestamptz WHERE id IN"
                + " (SELECT order_id FROM techverse.order_items WHERE course_id = ?::uuid)", timestamp, course);
    }

    // ------------------------------------------------------------------ Revenue detail (Task 1c)

    static final String BY_COURSE = REVENUE + "/courses";
    static final String ADMIN_REVENUE = "/api/v1/admin/revenue";

    @Test
    void revenueFiltersByCourseAndByDayInVietnamTime() throws Exception {
        String a = sell("Course A", 100_000, "FT-A");
        String b = sell("Course B", 200_000, "FT-B");
        paidAt(a, "2026-03-01 23:59:59+07");
        paidAt(b, "2026-03-02 00:00:00+07");

        assertThat(data(get(REVENUE, authorToken)).at("/totals/itemCount").asLong()).isEqualTo(2);
        var day1 = data(get(REVENUE + "?from=2026-03-01&to=2026-03-01", authorToken).andExpect(status().isOk()));
        assertThat(day1.at("/totals/grossAmount").asLong()).isEqualTo(100_000);
        assertThat(day1.at("/items/totalElements").asLong()).isEqualTo(1);
        var day2 = data(get(REVENUE + "?from=2026-03-02", authorToken));
        assertThat(day2.at("/totals/grossAmount").asLong()).isEqualTo(200_000);
        assertThat(day2.at("/items/content/0/courseId").asText()).isEqualTo(b);
        assertThat(data(get(REVENUE + "?to=2026-03-01", authorToken)).at("/totals/itemCount").asLong()).isEqualTo(1);
        assertThat(data(get(REVENUE + "?from=2026-03-01&to=2026-03-02", authorToken)).at("/totals/itemCount").asLong()).isEqualTo(2);
        var byCourse = data(get(REVENUE + "?courseId=" + a, authorToken));
        assertThat(byCourse.at("/totals/authorAmount").asLong()).isEqualTo(80_000);
        assertThat(byCourse.at("/items/totalElements").asLong()).isEqualTo(1);

        var none = data(get(REVENUE + "?from=2027-01-01", authorToken).andExpect(status().isOk()));
        assertThat(none.at("/totals/itemCount").asLong()).isZero();
        assertThat(none.at("/items/totalElements").asLong()).isZero();

        // The ledger part of the totals ignores the filter.
        payout(author, 30_000, "CHI-F", "0123456789");
        var filtered = data(get(REVENUE + "?from=2027-01-01", authorToken)).path("totals");
        assertThat(filtered.path("paidOutAmount").asLong()).isEqualTo(30_000);
        // So does the balance: earned over all time (80 000 + 160 000) minus paid out, never the filtered earnings.
        assertThat(filtered.path("balanceAmount").asLong()).isEqualTo(210_000);
        assertThat(data(get(REVENUE + "?courseId=" + a, authorToken)).at("/totals/balanceAmount").asLong()).isEqualTo(210_000);
        assertThat(data(get(REVENUE, authorToken)).at("/totals/balanceAmount").asLong()).isEqualTo(210_000);
    }

    @Test
    void invalidRevenueFiltersAreRejectedAndOtherAuthorsCoursesAreNotFound() throws Exception {
        for (String bad : new String[] {"from=2026/03/01", "from=2026-3-1", "to=abc", "from=2026-03-02&to=2026-03-01",
                "from=2026-02-30", "courseId=not-a-uuid", "from=&to=x"})
            for (String path : new String[] {REVENUE, BY_COURSE})
                if (!(path.equals(BY_COURSE) && bad.startsWith("courseId")))
                    get(path + "?" + bad, authorToken).andExpect(status().isBadRequest())
                            .andExpect(jsonPath("$.code").value("REVENUE_FILTER_INVALID"));
        get(ADMIN_REVENUE + "?from=2026-03-02&to=2026-03-01", adminToken).andExpect(status().isBadRequest());

        user("author2@example.com", "AUTHOR");
        String mine = authorToken;
        authorToken = login("author2@example.com");
        String theirs = publishedPaidCourse("Their course", 50_000);
        authorToken = mine;
        get(REVENUE + "?courseId=" + theirs, authorToken).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("COURSE_NOT_FOUND"));
        get(REVENUE + "?courseId=" + UUID.randomUUID(), authorToken).andExpect(status().isNotFound());
    }

    @Test
    void revenueGroupsByCourseWithTheHighestFirstAndOnlyCoursesSoldInTheRange() throws Exception {
        String a = sell("Course A", 100_000, "FT-A");
        String b = sell("Course B", 300_000, "FT-B");
        publishedPaidCourse("Unsold", 10_000);
        paidAt(a, "2026-03-01 10:00:00+07");
        paidAt(b, "2026-03-05 10:00:00+07");

        var all = data(get(BY_COURSE, authorToken).andExpect(status().isOk()));
        assertThat(all.path("totalElements").asLong()).isEqualTo(2);
        assertThat(all.at("/content/0/courseId").asText()).isEqualTo(b);
        assertThat(all.at("/content/0/courseTitle").asText()).isEqualTo("Course B");
        assertThat(all.at("/content/0/itemCount").asLong()).isEqualTo(1);
        assertThat(all.at("/content/0/grossAmount").asLong()).isEqualTo(300_000);
        assertThat(all.at("/content/0/platformAmount").asLong()).isEqualTo(60_000);
        assertThat(all.at("/content/0/authorAmount").asLong()).isEqualTo(240_000);
        assertThat(all.at("/content/1/courseId").asText()).isEqualTo(a);

        var range = data(get(BY_COURSE + "?from=2026-03-01&to=2026-03-02", authorToken));
        assertThat(range.path("totalElements").asLong()).isEqualTo(1);
        assertThat(range.at("/content/0/courseId").asText()).isEqualTo(a);
        assertThat(data(get(BY_COURSE + "?from=2027-01-01", authorToken)).path("totalElements").asLong()).isZero();
        assertThat(all.toString()).doesNotContain("authorName");

        // Another author's sales never show up.
        user("author2@example.com", "AUTHOR");
        assertThat(data(get(BY_COURSE, login("author2@example.com"))).path("totalElements").asLong()).isZero();
        for (String token : new String[] {learnerToken, modToken, adminToken})
            get(BY_COURSE, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(BY_COURSE, null).andExpect(status().isUnauthorized());
    }

    @Test
    void adminRevenueHasFilteredTotalsAnAllTimeLedgerAndPerCourseRows() throws Exception {
        String a = sell("Course A", 100_000, "FT-A");
        sell("Course B", 300_000, "FT-B");
        paidAt(a, "2026-03-01 10:00:00+07");
        payout(author, 50_000, "CHI-1", "0123456789");

        var all = data(get(ADMIN_REVENUE, adminToken).andExpect(status().isOk()));
        assertThat(all.at("/totals/itemCount").asLong()).isEqualTo(2);
        assertThat(all.at("/totals/grossAmount").asLong()).isEqualTo(400_000);
        assertThat(all.at("/totals/platformAmount").asLong()).isEqualTo(80_000);
        assertThat(all.at("/totals/authorAmount").asLong()).isEqualTo(320_000);
        assertThat(all.at("/ledger/earnedAmount").asLong()).isEqualTo(320_000);
        assertThat(all.at("/ledger/paidOutAmount").asLong()).isEqualTo(50_000);
        assertThat(all.at("/ledger/owedAmount").asLong()).isEqualTo(270_000);
        assertThat(all.at("/courses/totalElements").asLong()).isEqualTo(2);
        assertThat(all.at("/courses/content/0/courseTitle").asText()).isEqualTo("Course B");
        assertThat(all.at("/courses/content/0/authorId").asText()).isEqualTo(author.toString());
        assertThat(all.at("/courses/content/0/authorName").asText()).isNotBlank();

        var range = data(get(ADMIN_REVENUE + "?from=2026-03-01&to=2026-03-01", adminToken));
        assertThat(range.at("/totals/grossAmount").asLong()).isEqualTo(100_000);
        assertThat(range.at("/courses/totalElements").asLong()).isEqualTo(1);
        assertThat(range.at("/ledger/owedAmount").asLong()).isEqualTo(270_000);

        var empty = data(get(ADMIN_REVENUE + "?from=2027-01-01", adminToken).andExpect(status().isOk()));
        assertThat(empty.at("/totals/itemCount").asLong()).isZero();
        assertThat(empty.at("/courses/totalElements").asLong()).isZero();

        for (String token : new String[] {authorToken, modToken, learnerToken})
            get(ADMIN_REVENUE, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(ADMIN_REVENUE, null).andExpect(status().isUnauthorized());
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
