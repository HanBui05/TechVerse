package com.techverse.server.repository;

import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class PasswordResetRepository {
    public static final long TTL_SECONDS = 600;
    private static final String PREFIX = "auth:password-reset:";
    private static final DefaultRedisScript<Long> COUNTER = script("counter");
    private static final DefaultRedisScript<Long> ISSUE = script("issue");
    private static final DefaultRedisScript<Long> VERIFY = script("verify");
    private static final DefaultRedisScript<Long> CONSUME = script("consume");
    private final StringRedisTemplate redis;

    public boolean allowForgot(String emailHash, String ipHash) {
        if (increment("send-ip:" + ipHash, 3600) > 30) throw rateLimited();
        if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(PREFIX + "cooldown:" + emailHash,
                "1", Duration.ofSeconds(60)))) return false;
        return increment("send-email:" + emailHash, 3600) <= 5;
    }

    public void checkVerificationLimits(String emailHash, String ipHash) {
        if (increment("verify-ip:" + ipHash, 600) > 100
                || increment("verify-email:" + emailHash, 600) > 10) throw rateLimited();
    }

    public void issue(String emailHash, UUID userId, String otpHash) {
        redis.execute(ISSUE, List.of(stateKey(emailHash)), userId.toString(), otpHash, "600");
    }

    public boolean verify(String emailHash, String otpHash, String grantHash) {
        return Long.valueOf(1).equals(redis.execute(VERIFY,
                List.of(stateKey(emailHash), ticketKey(grantHash)), otpHash, grantHash, "600"));
    }

    public Optional<UUID> findUserId(String grantHash) {
        String value = redis.opsForValue().get(ticketKey(grantHash));
        return value == null ? Optional.empty() : Optional.of(UUID.fromString(value));
    }

    public boolean consume(String emailHash, String grantHash, UUID userId) {
        return Long.valueOf(1).equals(redis.execute(CONSUME, List.of(stateKey(emailHash), ticketKey(grantHash)),
                grantHash, userId.toString()));
    }

    private long increment(String suffix, long seconds) {
        Long result = redis.execute(COUNTER, List.of(PREFIX + "rate:" + suffix), Long.toString(seconds));
        if (result == null) throw new IllegalStateException("Redis did not return a password reset counter");
        return result;
    }

    private static String stateKey(String hash) { return PREFIX + "state:" + hash; }
    private static String ticketKey(String hash) { return PREFIX + "ticket:" + hash; }
    private CustomException rateLimited() { return new CustomException(ErrorCode.PASSWORD_RESET_RATE_LIMITED); }

    private static DefaultRedisScript<Long> script(String name) {
        var script = new DefaultRedisScript<Long>();
        script.setLocation(new ClassPathResource("redis/password-reset-" + name + ".lua"));
        script.setResultType(Long.class);
        return script;
    }
}
