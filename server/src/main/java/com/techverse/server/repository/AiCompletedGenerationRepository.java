package com.techverse.server.repository;

import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;

import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Repository;

import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

/**
 * Receipt of a validated draft, kept for the article-create handoff. Only a fingerprint is
 * stored, never the content; an absent {@code claimKey} field means unclaimed.
 */
@Repository
public class AiCompletedGenerationRepository {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final DefaultRedisScript<Long> SAVE =
            new DefaultRedisScript<>(
                    "redis.call('DEL',KEYS[1]) redis.call('HSET',KEYS[1],'fingerprint',ARGV[1])"
                            + " redis.call('EXPIRE',KEYS[1],ARGV[2]) return 1",
                    Long.class);
    private static final DefaultRedisScript<Long> CLAIM =
            new DefaultRedisScript<>(
                    "if redis.call('EXISTS',KEYS[1]) == 0 then return 0 end "
                            + "if redis.call('HGET',KEYS[1],'fingerprint') ~= ARGV[1] then return -1 end "
                            + "local claim=redis.call('HGET',KEYS[1],'claimKey') "
                            + "if not claim then redis.call('HSET',KEYS[1],'claimKey',ARGV[2]) return 1 end "
                            + "if claim == ARGV[2] then return 1 end return -1",
                    Long.class);

    private final StringRedisTemplate redis;
    private final AiAssistProperties properties;

    public AiCompletedGenerationRepository(StringRedisTemplate redis, AiAssistProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }

    public static String key(UUID author, UUID generationId) {
        return "ai:completed:" + author + ":" + generationId;
    }

    /** SHA-256 over canonical JSON; tag order does not matter. */
    public static String fingerprint(
            String title, String summary, String content, UUID topicId, List<UUID> tagIds) {
        var canonical = new LinkedHashMap<String, Object>();
        canonical.put("title", title);
        canonical.put("summary", summary);
        canonical.put("content", content);
        canonical.put("topicId", topicId.toString());
        canonical.put("tagIds", tagIds.stream().map(UUID::toString).sorted().toList());
        return sha256(JSON.writeValueAsString(canonical));
    }

    public static String sha256(String text) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Throws AI_STORAGE_UNAVAILABLE so the stream never reports completed without a receipt. */
    public void save(UUID author, UUID generationId, String fingerprint) {
        try {
            Long ok =
                    redis.execute(
                            SAVE,
                            List.of(key(author, generationId)),
                            fingerprint,
                            String.valueOf(properties.completedGenerationTtl().toSeconds()));
            if (ok == null) throw new CustomException(ErrorCode.AI_STORAGE_UNAVAILABLE);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.AI_STORAGE_UNAVAILABLE);
        }
    }

    /** Atomically verifies the completed receipt and binds it to one article idempotency key. */
    public void claim(
            UUID author, UUID generationId, String fingerprint, UUID idempotencyKey) {
        try {
            Long result =
                    redis.execute(
                            CLAIM,
                            List.of(key(author, generationId)),
                            fingerprint,
                            idempotencyKey.toString());
            if (result == null) throw new CustomException(ErrorCode.AI_STORAGE_UNAVAILABLE);
            if (result != 1L) throw new CustomException(ErrorCode.AI_GENERATION_INVALID);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.AI_STORAGE_UNAVAILABLE);
        }
    }
}
