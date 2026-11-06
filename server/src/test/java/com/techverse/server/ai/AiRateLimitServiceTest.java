package com.techverse.server.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.service.impl.AiRateLimitService;
import com.techverse.server.service.impl.AiRateLimitService.Kind;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

/** Real Redis (no Spring context): the Lua scripts are the thing under test. */
class AiRateLimitServiceTest {
  static final GenericContainer<?> REDIS =
      new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);
  static final LettuceConnectionFactory FACTORY;
  static final StringRedisTemplate TEMPLATE;

  static {
    REDIS.start();
    FACTORY = new LettuceConnectionFactory(REDIS.getHost(), REDIS.getMappedPort(6379));
    FACTORY.afterPropertiesSet();
    FACTORY.start();
    TEMPLATE = new StringRedisTemplate(FACTORY);
  }

  static class MutableClock extends Clock {
    Instant now;

    MutableClock(Instant now) {
      this.now = now;
    }

    @Override
    public ZoneId getZone() {
      return ZoneId.of("UTC");
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }

  // 23:58:00 in Asia/Ho_Chi_Minh (UTC+7).
  final MutableClock clock = new MutableClock(Instant.parse("2026-11-05T16:58:00Z"));
  final UUID author = UUID.randomUUID();

  static AiAssistProperties props(int outlinePerDay, int draftPerDay, int burst) {
    return new AiAssistProperties(
        Duration.ofSeconds(60),
        Map.of("SHORT", Duration.ofSeconds(90), "MEDIUM", Duration.ofSeconds(120), "LONG", Duration.ofSeconds(180)),
        Map.of("OUTLINE", 2048, "SHORT", 4096, "MEDIUM", 8192, "LONG", 16384),
        outlinePerDay,
        draftPerDay,
        burst,
        Duration.ofHours(24));
  }

  AiRateLimitService service(int outlinePerDay, int draftPerDay, int burst) {
    return new AiRateLimitService(TEMPLATE, props(outlinePerDay, draftPerDay, burst), clock);
  }

  @BeforeEach
  void flush() {
    TEMPLATE.execute(
        (org.springframework.data.redis.core.RedisCallback<Object>)
            c -> {
              c.serverCommands().flushAll();
              return null;
            });
  }

  @AfterAll
  static void close() {
    FACTORY.destroy();
  }

  @Test
  void dailyQuotaCountsDownThenRejectsWithoutConsuming() {
    var limits = service(2, 5, 100);
    var first = limits.reserve(author, Kind.OUTLINE);
    assertThat(first.limit()).isEqualTo(2);
    assertThat(first.remaining()).isEqualTo(1);
    assertThat(limits.reserve(author, Kind.OUTLINE).remaining()).isZero();
    assertThatThrownBy(() -> limits.reserve(author, Kind.OUTLINE))
        .extracting(e -> ((CustomException) e).getErrorCode())
        .isEqualTo(ErrorCode.AI_QUOTA_EXCEEDED);
    assertThat(TEMPLATE.opsForValue().get("ai:quota:outline:" + author + ":20261105")).isEqualTo("2");
    assertThat(TEMPLATE.getExpire("ai:quota:outline:" + author + ":20261105"))
        .isBetween(172_000L, 172_800L);
  }

  @Test
  void burstIsSharedAcrossKindsAndResetsNextMinute() {
    var limits = service(10, 10, 3);
    limits.reserve(author, Kind.OUTLINE);
    limits.reserve(author, Kind.DRAFT);
    limits.reserve(author, Kind.OUTLINE);
    assertThatThrownBy(() -> limits.reserve(author, Kind.DRAFT))
        .extracting(e -> ((CustomException) e).getErrorCode())
        .isEqualTo(ErrorCode.AI_RATE_LIMITED);
    assertThat(TEMPLATE.getExpire("ai:rate:minute:" + author + ":202611052358")).isBetween(100L, 120L);
    // A burst rejection must not consume daily quota.
    assertThat(TEMPLATE.opsForValue().get("ai:quota:draft:" + author + ":20261105")).isEqualTo("1");

    clock.now = clock.now.plusSeconds(60);
    assertThat(limits.reserve(author, Kind.DRAFT).remaining()).isEqualTo(8);
  }

  @Test
  void outlineAndDraftDailyQuotasAreIndependent() {
    var limits = service(1, 1, 100);
    limits.reserve(author, Kind.OUTLINE);
    assertThat(limits.reserve(author, Kind.DRAFT).remaining()).isZero();
  }

  @Test
  void dayRollsOverAtMidnightHoChiMinhTime() {
    var limits = service(1, 1, 100);
    limits.reserve(author, Kind.OUTLINE);
    clock.now = Instant.parse("2026-11-05T17:00:00Z"); // 00:00 on 6 Nov in UTC+7
    assertThat(limits.reserve(author, Kind.OUTLINE).remaining()).isZero();
    assertThat(TEMPLATE.hasKey("ai:quota:outline:" + author + ":20261106")).isTrue();
  }

  @Test
  void refundReturnsExactlyOneUseEvenWhenRepeated() {
    var limits = service(3, 5, 100);
    limits.reserve(author, Kind.OUTLINE);
    var second = limits.reserve(author, Kind.OUTLINE);
    assertThat(limits.refund(second).remaining()).isEqualTo(2);
    assertThat(limits.refund(second).remaining()).isEqualTo(2);
    assertThat(TEMPLATE.opsForValue().get("ai:quota:outline:" + author + ":20261105")).isEqualTo("1");
  }

  @Test
  void refundAfterMidnightRestoresTheDayItWasTakenFrom() {
    var limits = service(1, 1, 100);
    var reservation = limits.reserve(author, Kind.OUTLINE);
    clock.now = Instant.parse("2026-11-05T17:00:30Z");
    limits.refund(reservation);
    assertThat(TEMPLATE.opsForValue().get("ai:quota:outline:" + author + ":20261105")).isEqualTo("0");
    assertThat(TEMPLATE.hasKey("ai:quota:outline:" + author + ":20261106")).isFalse();
  }

  @Test
  void concurrentReservationsNeverExceedTheLimit() throws Exception {
    var limits = service(10, 10, 1000);
    try (var pool = Executors.newFixedThreadPool(16)) {
      var tasks = IntStream.range(0, 40)
          .<Callable<Boolean>>mapToObj(i -> () -> {
            try {
              limits.reserve(author, Kind.OUTLINE);
              return true;
            } catch (CustomException e) {
              return false;
            }
          })
          .toList();
      long granted = pool.invokeAll(tasks).stream().filter(f -> {
        try {
          return f.get();
        } catch (Exception e) {
          throw new IllegalStateException(e);
        }
      }).count();
      assertThat(granted).isEqualTo(10);
    }
    assertThat(TEMPLATE.opsForValue().get("ai:quota:outline:" + author + ":20261105")).isEqualTo("10");
  }

  @Test
  void redisFailureFailsClosed() {
    var broken = mock(StringRedisTemplate.class);
    when(broken.execute(any(RedisScript.class), anyList(), any(Object[].class)))
        .thenThrow(new RedisConnectionFailureException("down"));
    var limits = new AiRateLimitService(broken, props(10, 10, 10), clock);
    assertThatThrownBy(() -> limits.reserve(author, Kind.OUTLINE))
        .extracting(e -> ((CustomException) e).getErrorCode())
        .isEqualTo(ErrorCode.AI_STORAGE_UNAVAILABLE);
  }

  @Test
  void peekReadsTheDailyAllowanceWithoutConsumingDailyOrBurst() {
    var limits = service(10, 5, 1);
    assertThat(limits.peek(author, Kind.OUTLINE)).isEqualTo(new AiRateLimitService.Quota(10, 10));
    limits.reserve(author, Kind.DRAFT);
    assertThat(limits.peek(author, Kind.DRAFT)).isEqualTo(new AiRateLimitService.Quota(5, 4));
    assertThat(limits.peek(author, Kind.DRAFT)).isEqualTo(new AiRateLimitService.Quota(5, 4));
    assertThat(TEMPLATE.opsForValue().get("ai:quota:draft:" + author + ":20261105")).isEqualTo("1");
    assertThat(TEMPLATE.opsForValue().get("ai:rate:minute:" + author + ":202611052358")).isEqualTo("1");
  }

  @Test
  void peekFailsClosedWhenRedisIsDown() {
    var broken = mock(StringRedisTemplate.class);
    when(broken.opsForValue()).thenThrow(new RedisConnectionFailureException("down"));
    var limits = new AiRateLimitService(broken, props(10, 10, 10), clock);
    assertThatThrownBy(() -> limits.peek(author, Kind.DRAFT))
        .extracting(e -> ((CustomException) e).getErrorCode())
        .isEqualTo(ErrorCode.AI_STORAGE_UNAVAILABLE);
  }

  @Test
  void refundFailureDoesNotThrowSoTheOriginalErrorSurvives() {
    var reservation = service(10, 10, 10).reserve(author, Kind.OUTLINE);
    var broken = mock(StringRedisTemplate.class);
    when(broken.execute(any(RedisScript.class), anyList(), any(Object[].class)))
        .thenThrow(new RedisConnectionFailureException("down"));
    assertThat(new AiRateLimitService(broken, props(10, 10, 10), clock).refund(reservation)).isNull();
  }
}
