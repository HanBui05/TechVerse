package com.techverse.server.service.impl;

import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.BooleanSupplier;

/**
 * Running draft streams, one per Author. A finished entry stays as a tombstone until
 * start + timeout + 10 minutes so a late DELETE is answered idempotently.
 *
 * <p>shortcut: in-memory, single instance only; multi-instance needs sticky routing or a Redis
 * cancel bus.
 */
@Component
public class AiGenerationRegistry {
    static final Duration TOMBSTONE_GRACE = Duration.ofMinutes(10);

    public enum CancelResult {
        CANCELLED,
        ALREADY_FINISHED
    }

    private static final class Entry {
        final UUID author;
        final Instant expiresAt;
        boolean running = true;
        BooleanSupplier canceller = () -> false;

        Entry(UUID author, Instant expiresAt) {
            this.author = author;
            this.expiresAt = expiresAt;
        }
    }

    private final Map<UUID, Entry> entries = new HashMap<>();
    private final Clock clock;

    public AiGenerationRegistry(Clock clock) {
        this.clock = clock;
    }

    /** Throws AI_GENERATION_IN_PROGRESS when the Author already has a running stream. */
    public synchronized UUID start(UUID author, Duration timeout) {
        purge();
        if (entries.values().stream().anyMatch(e -> e.running && e.author.equals(author)))
            throw new CustomException(ErrorCode.AI_GENERATION_IN_PROGRESS);
        UUID id = UUID.randomUUID();
        entries.put(id, new Entry(author, clock.instant().plus(timeout).plus(TOMBSTONE_GRACE)));
        return id;
    }

    /** The canceller returns true only when it actually stopped a running stream. */
    public synchronized void attach(UUID id, BooleanSupplier canceller) {
        Entry e = entries.get(id);
        if (e != null) e.canceller = canceller;
    }

    /** Idempotent; frees the Author's slot and keeps the tombstone. */
    public synchronized void finish(UUID id) {
        Entry e = entries.get(id);
        if (e != null) e.running = false;
    }

    /** Unknown and foreign IDs look the same so the owner is not revealed. */
    public CancelResult cancel(UUID actor, UUID id) {
        BooleanSupplier canceller;
        synchronized (this) {
            purge();
            Entry e = entries.get(id);
            if (e == null || !e.author.equals(actor))
                throw new CustomException(ErrorCode.AI_GENERATION_NOT_FOUND);
            if (!e.running) return CancelResult.ALREADY_FINISHED;
            canceller = e.canceller;
        }
        // Outside the lock: the canceller calls finish() and writes to the client.
        return canceller.getAsBoolean() ? CancelResult.CANCELLED : CancelResult.ALREADY_FINISHED;
    }

    private void purge() {
        Instant now = clock.instant();
        // A running entry past its expiry is a leaked stream; drop it so the Author is not stuck.
        entries.values().removeIf(e -> !now.isBefore(e.expiresAt));
    }
}
