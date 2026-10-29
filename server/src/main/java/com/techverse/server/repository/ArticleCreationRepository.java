package com.techverse.server.repository;

import com.techverse.server.dto.internal.ArticleCreationReceipt;
import com.techverse.server.exception.*;

import lombok.RequiredArgsConstructor;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class ArticleCreationRepository {
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    private String key(UUID user, UUID key) {
        return "article:create:" + user + ":" + key;
    }

    public ArticleCreationReceipt find(UUID user, UUID key) {
        try {
            String value = redis.opsForValue().get(key(user, key));
            return value == null ? null : mapper.readValue(value, ArticleCreationReceipt.class);
        } catch (Exception e) {
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        }
    }

    public void save(UUID user, UUID key, ArticleCreationReceipt receipt) {
        try {
            redis.opsForValue()
                    .set(key(user, key), mapper.writeValueAsString(receipt), Duration.ofHours(24));
        } catch (Exception e) {
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        }
    }
}
