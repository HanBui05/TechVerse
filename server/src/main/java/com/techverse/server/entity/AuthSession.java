package com.techverse.server.entity;

import java.time.Instant;
import java.util.concurrent.TimeUnit;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;

@RedisHash("auth:session")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthSession {

	@Id
	private String id;
	private String userId;
	private String refreshJwtId;
	private Instant createdAt;
	private Instant expiresAt;

	@TimeToLive(unit = TimeUnit.SECONDS)
	private long timeToLive;
}
