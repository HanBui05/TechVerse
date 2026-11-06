package com.techverse.server.repository;

import com.techverse.server.dto.internal.CourseCreationReceipt;
import com.techverse.server.exception.*;

import lombok.RequiredArgsConstructor;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.UUID;

/** Redis receipts for idempotent course/lesson creation, plus 24h tombstones of hard deletes. */
@Repository
@RequiredArgsConstructor
public class CourseCreationRepository {
    public enum Kind {
        COURSE,
        LESSON
    }

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    private static String key(Kind kind, UUID user, UUID key) {
        return kind.name().toLowerCase() + ":create:" + user + ":" + key;
    }

    private static String tombstone(Kind kind, UUID id) {
        return kind.name().toLowerCase() + ":deleted:" + id;
    }

    public CourseCreationReceipt find(Kind kind, UUID user, UUID key) {
        try {
            String value = redis.opsForValue().get(key(kind, user, key));
            return value == null ? null : mapper.readValue(value, CourseCreationReceipt.class);
        } catch (Exception e) {
            throw new CustomException(ErrorCode.COURSE_STORAGE_UNAVAILABLE);
        }
    }

    public void save(Kind kind, UUID user, UUID key, CourseCreationReceipt receipt) {
        try {
            redis.opsForValue().set(key(kind, user, key), mapper.writeValueAsString(receipt), Duration.ofHours(24));
        } catch (Exception e) {
            throw new CustomException(ErrorCode.COURSE_STORAGE_UNAVAILABLE);
        }
    }

    /** A create retry must not resurrect a hard-deleted course or lesson. */
    public void markDeleted(Kind kind, UUID id) {
        try {
            redis.opsForValue().set(tombstone(kind, id), "1", Duration.ofHours(24));
        } catch (Exception e) {
            throw new CustomException(ErrorCode.COURSE_STORAGE_UNAVAILABLE);
        }
    }

    public boolean isDeleted(Kind kind, UUID id) {
        try {
            return Boolean.TRUE.equals(redis.hasKey(tombstone(kind, id)));
        } catch (Exception e) {
            throw new CustomException(ErrorCode.COURSE_STORAGE_UNAVAILABLE);
        }
    }
}
