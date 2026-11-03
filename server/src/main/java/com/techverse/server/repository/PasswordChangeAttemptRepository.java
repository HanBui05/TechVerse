package com.techverse.server.repository;

import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class PasswordChangeAttemptRepository {
	private static final int MAX_FAILURES = 5;
	private static final String WINDOW_SECONDS = "900";
	private static final String PREFIX = "auth:password-change:failures:";
	private static final DefaultRedisScript<Long> COUNTER = new DefaultRedisScript<>();

	static {
		COUNTER.setLocation(new ClassPathResource("redis/password-change-counter.lua"));
		COUNTER.setResultType(Long.class);
	}

	private final StringRedisTemplate redis;

	public boolean isBlocked(UUID userId) {
		String count = redis.opsForValue().get(PREFIX + userId);
		return count != null && Long.parseLong(count) >= MAX_FAILURES;
	}

	public void recordFailure(UUID userId) {
		redis.execute(COUNTER, List.of(PREFIX + userId), WINDOW_SECONDS);
	}

	public void reset(UUID userId) {
		redis.delete(PREFIX + userId);
	}
}
