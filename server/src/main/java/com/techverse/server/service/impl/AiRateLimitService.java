package com.techverse.server.service.impl;

import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;

import lombok.extern.slf4j.Slf4j;

import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Per-Author AI limits in Redis; fails closed when Redis is unavailable. */
@Slf4j
@Service
public class AiRateLimitService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter MINUTE = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final long DAY_TTL_SECONDS = 48 * 3600;

    /** Returns the new daily count, -1 when the day is used up, -2 when the burst is. */
    private static final DefaultRedisScript<Long> RESERVE =
            new DefaultRedisScript<>(
                    "local d=tonumber(redis.call('GET',KEYS[2]) or '0')"
                            + " if d>=tonumber(ARGV[2]) then return -1 end"
                            + " local b=tonumber(redis.call('GET',KEYS[1]) or '0')"
                            + " if b>=tonumber(ARGV[1]) then return -2 end"
                            + " redis.call('INCR',KEYS[1]) redis.call('EXPIRE',KEYS[1],120)"
                            + " d=redis.call('INCR',KEYS[2]) redis.call('EXPIRE',KEYS[2],ARGV[3])"
                            + " return d",
                    Long.class);

    /** Decrements once per operation ID; returns the daily count after the call. */
    private static final DefaultRedisScript<Long> REFUND =
            new DefaultRedisScript<>(
                    "local d=tonumber(redis.call('GET',KEYS[2]) or '0')"
                            + " if redis.call('SET',KEYS[1],'1','NX','EX',ARGV[1]) and d>0 then"
                            + " d=redis.call('DECR',KEYS[2]) end return d",
                    Long.class);

    public enum Kind {
        OUTLINE,
        DRAFT
    }

    public record Quota(int limit, int remaining) {}

    public record Reservation(String operationId, String dayKey, int limit, int remaining) {
        public Quota quota() {
            return new Quota(limit, remaining);
        }
    }

    private final StringRedisTemplate redis;
    private final AiAssistProperties properties;
    private final Clock clock;

    public AiRateLimitService(StringRedisTemplate redis, AiAssistProperties properties, Clock clock) {
        this.redis = redis;
        this.properties = properties;
        this.clock = clock;
    }

    public Reservation reserve(UUID author, Kind kind) {
        var now = clock.instant().atZone(ZONE);
        String dayKey =
                "ai:quota:" + kind.name().toLowerCase(Locale.ROOT) + ":" + author + ":" + DAY.format(now);
        String burstKey = "ai:rate:minute:" + author + ":" + MINUTE.format(now);
        int limit = kind == Kind.OUTLINE ? properties.outlinePerDay() : properties.draftPerDay();
        Long count;
        try {
            count =
                    redis.execute(
                            RESERVE,
                            List.of(burstKey, dayKey),
                            String.valueOf(properties.burstPerMinute()),
                            String.valueOf(limit),
                            String.valueOf(DAY_TTL_SECONDS));
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.AI_STORAGE_UNAVAILABLE);
        }
        if (count == null) throw new CustomException(ErrorCode.AI_STORAGE_UNAVAILABLE);
        if (count == -1) throw new CustomException(ErrorCode.AI_QUOTA_EXCEEDED);
        if (count == -2) throw new CustomException(ErrorCode.AI_RATE_LIMITED);
        return new Reservation(UUID.randomUUID().toString(), dayKey, limit, remaining(limit, count));
    }

    /** Idempotent; returns null (and logs) when Redis fails so the caller's error survives. */
    public Quota refund(Reservation reservation) {
        try {
            Long count =
                    redis.execute(
                            REFUND,
                            List.of("ai:refund:" + reservation.operationId(), reservation.dayKey()),
                            String.valueOf(DAY_TTL_SECONDS));
            if (count == null) return null;
            return new Quota(reservation.limit(), remaining(reservation.limit(), count));
        } catch (DataAccessException e) {
            log.warn("AI quota refund failed for operation {}", reservation.operationId());
            return null;
        }
    }

    private static int remaining(int limit, long used) {
        return (int) Math.max(0, limit - used);
    }
}
