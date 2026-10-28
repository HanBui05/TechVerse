package com.techverse.server.entity;

import com.techverse.server.enums.TokenType;
import java.util.concurrent.TimeUnit;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;

@RedisHash("auth:token")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Token {

	@Id
	private String jwtId;

	private String userId;
	private String sessionId;

	private TokenType tokenType;

	@TimeToLive(unit = TimeUnit.SECONDS)
	private long timeToLive;
}
