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
            mock(UserRepository.class), redis);

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
    void accountNumbersAreMaskedToTheLastFourCharacters() {
        assertThat(mask("0123456789")).isEqualTo("****6789");
        assertThat(mask("AB1234")).isEqualTo("****1234");
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
