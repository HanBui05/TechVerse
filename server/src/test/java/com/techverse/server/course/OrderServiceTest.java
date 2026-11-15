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

import java.util.UUID;

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
