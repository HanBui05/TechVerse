package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.techverse.server.exception.*;
import com.techverse.server.repository.*;
import com.techverse.server.service.impl.OrderService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.*;

/** VietQR link, receiving-account validation and the order rate limit, without Spring. */
class OrderServiceTest {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    OrderService service = new OrderService(
            mock(OrderRepository.class), mock(CourseRepository.class), mock(CourseEnrollmentRepository.class),
            mock(UserRepository.class), redis, mock(com.techverse.server.service.impl.PayosClient.class),
            mock(org.springframework.transaction.PlatformTransactionManager.class));

    @BeforeEach
    void configure() {
        set("bankId", "970422");
        set("accountNo", "0123456789");
        set("accountName", " Nguyễn Văn A ");
        set("template", "compact2");
        set("requestsPerMinute", 5);
    }

    @Test
    void buildsAnEncodedVietQrLinkWithTheOrderCodeAsTransferContent() {
        var qr = qr(250_000, "TV000000000042");
        assertThat(qr.content()).isEqualTo("TV000000000042");
        assertThat(qr.accountName()).isEqualTo("Nguyễn Văn A");
        assertThat(qr.imageUrl()).isEqualTo("https://img.vietqr.io/image/970422-0123456789-compact2.png"
                + "?amount=250000&addInfo=TV000000000042&accountName=Nguy%E1%BB%85n%20V%C4%83n%20A");
    }

    @Test
    void missingOrMalformedAccountSettingsMeanNoQrAndPaymentsUnavailable() {
        assertThat(configured()).isTrue();
        for (var bad : new Object[][] {
                {"bankId", ""}, {"bankId", "970/22"}, {"bankId", null},
                {"accountNo", ""}, {"accountNo", "0123-456"}, {"accountNo", "12345"},
                {"accountName", "  "}, {"template", "compact2.png?x"}}) {
            configure();
            set((String) bad[0], bad[1]);
            assertThat(configured()).as("%s=%s", bad[0], bad[1]).isFalse();
            assertThat(qr(10_000, "TV000000000001")).isNull();
        }
    }

    @Test
    void sixthRequestWithinAMinuteIsRateLimitedAndRedisFailureIsUnavailable() {
        UUID user = UUID.randomUUID();
        when(redis.execute(any(RedisScript.class), anyList())).thenReturn(5L, 6L);
        assertThatCode(() -> rate(user)).doesNotThrowAnyException();
        assertThatThrownBy(() -> rate(user)).extracting("errorCode").isEqualTo(ErrorCode.ORDER_RATE_LIMITED);

        when(redis.execute(any(RedisScript.class), anyList())).thenThrow(new RedisConnectionFailureException("down"));
        assertThatThrownBy(() -> rate(user)).extracting("errorCode").isEqualTo(ErrorCode.PAYMENT_UNAVAILABLE);
    }

    @Test
    void payoutAccountBodyIsNormalisedAndEveryBoundaryIsChecked() {
        assertThat(account(body(" 970436 ", " 0123456789 ", "  Nguyễn Văn A ")))
                .extracting("bankId", "accountNo", "accountName")
                .containsExactly("970436", "0123456789", "NGUYỄN VĂN A");
        assertThat(account(body("970422", "ABC123", "x"))).extracting("accountName").isEqualTo("X");
        assertThat(account(body("970422", "a".repeat(30), "n".repeat(100)))).isNotNull();

        var tooMany = new HashMap<String, Object>(body("970436", "0123456789", "A"));
        tooMany.put("extra", "x");
        var missing = new HashMap<String, Object>(body("970436", "0123456789", "A"));
        missing.remove("accountName");
        var wrongKey = new HashMap<String, Object>(missing);
        wrongKey.put("name", "A");
        var nullValue = new HashMap<String, Object>(missing);
        nullValue.put("accountName", null);
        var number = new HashMap<String, Object>(body("970436", "0123456789", "A"));
        number.put("accountNo", 123456789);
        for (Map<String, Object> bad : Arrays.<Map<String, Object>>asList(
                null, Map.of(), tooMany, missing, wrongKey, nullValue, number,
                body("000000", "0123456789", "A"),          // bank not supported
                body("", "0123456789", "A"),
                body("970436", "12345", "A"),               // 5 chars
                body("970436", "a".repeat(31), "A"),
                body("970436", "0123-4567", "A"),
                body("970436", "0123 4567", "A"),
                body("970436", "012345678ố", "A"),
                body("970436", "0123456789", "   "),
                body("970436", "0123456789", "n".repeat(101)),
                body("970436", "0123456789", "A\nB")))
            assertThatThrownBy(() -> account(bad)).as("%s", bad)
                    .extracting("errorCode").isEqualTo(ErrorCode.PAYOUT_ACCOUNT_INVALID);
    }

    @Test
    void revenueRangeIsVietnamDaysInclusiveAndEitherEndMayBeOpen() {
        var both = OrderService.range("2026-03-01", "2026-03-02");
        assertThat(both[0]).isEqualTo(java.time.Instant.parse("2026-02-28T17:00:00Z"));
        assertThat(both[1]).isEqualTo(java.time.Instant.parse("2026-03-02T17:00:00Z"));
        assertThat(OrderService.range("2026-03-01", "2026-03-01")[1]).isEqualTo(java.time.Instant.parse("2026-03-01T17:00:00Z"));
        var open = OrderService.range(null, null);
        assertThat(open[0]).isBefore(java.time.Instant.parse("2000-01-01T00:00:00Z"));
        assertThat(open[1]).isAfter(java.time.Instant.parse("3000-01-01T00:00:00Z"));
        assertThat(OrderService.range("", "")[0]).isEqualTo(open[0]);
        assertThat(OrderService.range("2026-03-01", null)[1]).isEqualTo(open[1]);
        for (var bad : new String[][] {{"2026/03/01", null}, {null, "x"}, {"2026-3-1", null}, {"2026-02-30", null},
                {"2026-03-02", "2026-03-01"}, {" 2026-03-01", null}})
            assertThatThrownBy(() -> OrderService.range(bad[0], bad[1])).as("%s..%s", bad[0], bad[1])
                    .extracting("errorCode").isEqualTo(ErrorCode.REVENUE_FILTER_INVALID);
    }

    @Test
    void accountNumbersAreMaskedToTheLastFourCharacters() {
        assertThat(mask("0123456789")).isEqualTo("****6789");
        assertThat(mask("AB1234")).isEqualTo("****1234");
    }

    @Test
    void payoutBodyIsNormalisedAndEveryBoundaryIsChecked() {
        UUID author = UUID.randomUUID();
        assertThat(payout(payoutBody(author.toString(), 5, " FT1 ", " 970436 ", " 0123456789 ", " Văn a ")))
                .extracting("authorId", "amount", "bankReference")
                .containsExactly(author, 5L, "FT1");
        assertThat(payout(payoutBody(author.toString(), 5, "FT1", "970436", "0123456789", " Văn a ")))
                .extracting("account").extracting("bankId", "accountNo", "accountName")
                .containsExactly("970436", "0123456789", "VĂN A");
        assertThat(payout(payoutBody(author.toString(), Long.MAX_VALUE, "r".repeat(255), "970436", "0123456789", "A")))
                .isNotNull();

        String id = author.toString();
        var tooMany = payoutBody(id, 5, "FT1", "970436", "0123456789", "A");
        tooMany.put("extra", "x");
        var missing = payoutBody(id, 5, "FT1", "970436", "0123456789", "A");
        missing.remove("bankReference");
        var wrongKey = new HashMap<>(missing);
        wrongKey.put("reference", "FT1");
        for (Map<String, Object> bad : Arrays.<Map<String, Object>>asList(
                null, Map.of(), tooMany, missing, wrongKey,
                payoutBody("not-a-uuid", 5, "FT1", "970436", "0123456789", "A"),
                payoutBody("1-1-1-1-1", 5, "FT1", "970436", "0123456789", "A"),
                payoutBody(null, 5, "FT1", "970436", "0123456789", "A"),
                payoutBody(id, 0, "FT1", "970436", "0123456789", "A"),
                payoutBody(id, -1, "FT1", "970436", "0123456789", "A"),
                payoutBody(id, 1.5, "FT1", "970436", "0123456789", "A"),
                payoutBody(id, "5", "FT1", "970436", "0123456789", "A"),
                payoutBody(id, new java.math.BigInteger("9223372036854775808"), "FT1", "970436", "0123456789", "A"),
                payoutBody(id, null, "FT1", "970436", "0123456789", "A"),
                payoutBody(id, 5, "  ", "970436", "0123456789", "A"),
                payoutBody(id, 5, "r".repeat(256), "970436", "0123456789", "A"),
                payoutBody(id, 5, 7, "970436", "0123456789", "A"),
                payoutBody(id, 5, "FT1", "000000", "0123456789", "A"),
                payoutBody(id, 5, "FT1", "970436", "12345", "A"),
                payoutBody(id, 5, "FT1", "970436", "0123-4567", "A"),
                payoutBody(id, 5, "FT1", "970436", "0123456789", " "),
                payoutBody(id, 5, "FT1", "970436", "0123456789", "n".repeat(101))))
            assertThatThrownBy(() -> payout(bad)).as("%s", bad)
                    .extracting("errorCode").isEqualTo(ErrorCode.PAYOUT_INVALID);
    }

    @Test
    void payoutQrPaysTheAuthorsAccountNotThePlatformsAndEncodesTheContent() {
        UUID author = UUID.fromString("0a1b2c3d-0000-0000-0000-000000000000");
        var qr = (com.techverse.server.dto.response.OrderResponse.VietQr) ReflectionTestUtils.invokeMethod(
                service, "payoutQr", author, "970436", "AB123456", "NGUYỄN VĂN A", 159_200L);
        assertThat(qr.bankId()).isEqualTo("970436");
        assertThat(qr.accountNo()).isEqualTo("AB123456");
        assertThat(qr.content()).isEqualTo("TVPAY0A1B2C3D");
        assertThat(qr.imageUrl()).isEqualTo("https://img.vietqr.io/image/970436-AB123456-compact2.png"
                + "?amount=159200&addInfo=TVPAY0A1B2C3D&accountName=NGUY%E1%BB%84N%20V%C4%82N%20A");
        assertThat((Object) ReflectionTestUtils.invokeMethod(service, "payoutQr", author, "970436", "AB123456", "A", 0L)).isNull();
    }

    @Test
    void payosSyncDecisionFollowsTheRuleTable() {
        var pending = com.techverse.server.entity.CourseOrder.Status.PENDING;
        var expired = com.techverse.server.entity.CourseOrder.Status.EXPIRED;
        var paid = com.techverse.server.entity.CourseOrder.Status.PAID;
        var cancelled = com.techverse.server.entity.CourseOrder.Status.CANCELLED;
        // Paid in full, overpaid: confirm an open order, link stored or not yet stored.
        assertThat(decide(pending, "link_1", payment("link_1", 42L, "PAID", 199_000L, 199_000L))).isEqualTo("CONFIRM");
        assertThat(decide(expired, null, payment("link_1", 42L, "PAID", 199_000L, 199_000L))).isEqualTo("CONFIRM");
        assertThat(decide(pending, "link_1", payment("link_1", 42L, "PAID", 199_000L, 250_000L))).isEqualTo("CONFIRM");
        // Already PAID or a state that never grants: only the amount payOS reports is recorded.
        assertThat(decide(paid, "link_1", payment("link_1", 42L, "PAID", 199_000L, 199_000L))).isEqualTo("RECORD");
        assertThat(decide(cancelled, "link_1", payment("link_1", 42L, "PAID", 199_000L, 199_000L))).isEqualTo("RECORD");
        // Short payment: recorded, no access.
        assertThat(decide(pending, "link_1", payment("link_1", 42L, "PENDING", 199_000L, 50_000L))).isEqualTo("RECORD");
        assertThat(decide(pending, "link_1", payment("link_1", 42L, "PAID", 199_000L, 50_000L))).isEqualTo("RECORD");
        // Not paid, cancelled, expired on payOS: nothing changes.
        for (String status : List.of("PENDING", "CANCELLED", "EXPIRED"))
            assertThat(decide(pending, "link_1", payment("link_1", 42L, status, 199_000L, 0L))).as(status).isEqualTo("NOTHING");
        // Another link, order or amount, or a missing field: ignored and logged.
        assertThat(decide(pending, "link_1", payment("link_2", 42L, "PAID", 199_000L, 199_000L))).isEqualTo("IGNORE");
        assertThat(decide(pending, "link_1", payment("link_1", 43L, "PAID", 199_000L, 199_000L))).isEqualTo("IGNORE");
        assertThat(decide(pending, "link_1", payment("link_1", 42L, "PAID", 99_000L, 199_000L))).isEqualTo("IGNORE");
        assertThat(decide(pending, null, payment(null, 42L, "PAID", 199_000L, 199_000L))).isEqualTo("IGNORE");
        assertThat(decide(pending, "link_1", payment("link_1", null, "PAID", 199_000L, 199_000L))).isEqualTo("IGNORE");
        assertThat(decide(pending, "link_1", payment("link_1", 42L, null, 199_000L, 199_000L))).isEqualTo("IGNORE");
        assertThat(decide(pending, "link_1", payment("link_1", 42L, "PAID", null, 199_000L))).isEqualTo("IGNORE");
        assertThat(decide(pending, "link_1", payment("link_1", 42L, "PAID", 199_000L, null))).isEqualTo("IGNORE");
    }

    static com.techverse.server.service.impl.PayosClient.Payment payment(String id, Long no, String status, Long amount, Long paid) {
        return new com.techverse.server.service.impl.PayosClient.Payment(id, no, status, amount, paid);
    }

    String decide(com.techverse.server.entity.CourseOrder.Status status, String link,
            com.techverse.server.service.impl.PayosClient.Payment p) {
        return String.valueOf((Object) ReflectionTestUtils.invokeMethod(OrderService.class, "decide", status, link, 42L, 199_000L, p));
    }

    static Map<String, Object> payoutBody(Object authorId, Object amount, Object ref, String bankId, String accountNo, String name) {
        var body = new HashMap<String, Object>();
        body.put("authorId", authorId);
        body.put("amount", amount);
        body.put("bankReference", ref);
        body.put("bankId", bankId);
        body.put("accountNo", accountNo);
        body.put("accountName", name);
        return body;
    }

    Object payout(Map<String, Object> body) {
        return ReflectionTestUtils.invokeMethod(OrderService.class, "payoutInput", body);
    }

    static Map<String, Object> body(String bankId, String accountNo, String accountName) {
        return Map.of("bankId", bankId, "accountNo", accountNo, "accountName", accountName);
    }

    Object account(Map<String, Object> body) {
        return ReflectionTestUtils.invokeMethod(OrderService.class, "payoutAccountInput", body);
    }

    String mask(String accountNo) {
        return ReflectionTestUtils.invokeMethod(OrderService.class, "maskAccountNo", accountNo);
    }

    // Package-private helpers of OrderService are reached reflectively from this package.
    com.techverse.server.dto.response.OrderResponse.VietQr qr(long amount, String code) {
        return ReflectionTestUtils.invokeMethod(service, "vietQr", amount, code);
    }

    boolean configured() {
        return Boolean.TRUE.equals(ReflectionTestUtils.invokeMethod(service, "qrConfigured"));
    }

    void rate(UUID user) {
        ReflectionTestUtils.invokeMethod(service, "checkRate", user);
    }

    void set(String field, Object value) {
        ReflectionTestUtils.setField(service, field, value);
    }
}
