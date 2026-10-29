package com.techverse.server.service.impl;

import com.techverse.server.exception.*;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ArticleRateLimitService {
    private final StringRedisTemplate redis;

    @Value("${article.imports-per-hour:60}")
    private int importsPerHour;

    @Value("${article.uploads-per-hour:100}")
    private int uploadsPerHour;

    private static final DefaultRedisScript<Long> COUNTER =
            new DefaultRedisScript<>(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then"
                            + " redis.call('EXPIRE',KEYS[1],3600) end; return n",
                    Long.class);

    public void check(UUID user, boolean image) {
        try {
            Long count =
                    redis.execute(
                            COUNTER,
                            List.of("article:rate:" + (image ? "image:" : "import:") + user));
            if (count == null) throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
            if (count > (image ? uploadsPerHour : importsPerHour))
                throw new CustomException(ErrorCode.ARTICLE_RATE_LIMITED);
        } catch (org.springframework.dao.DataAccessException e) {
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        }
    }
}
