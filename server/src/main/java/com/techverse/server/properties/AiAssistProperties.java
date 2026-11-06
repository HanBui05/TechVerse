package com.techverse.server.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/** TechVerse AI policy (deadlines, token caps, quotas). Invalid values fail startup by name. */
@ConfigurationProperties(prefix = "ai.assist")
public record AiAssistProperties(
        Duration outlineTimeout,
        Map<String, Duration> draftTimeouts,
        Map<String, Integer> maxCompletionTokens,
        int outlinePerDay,
        int draftPerDay,
        int burstPerMinute,
        Duration completedGenerationTtl) {
    static final List<String> LENGTHS = List.of("SHORT", "MEDIUM", "LONG");

    public AiAssistProperties {
        positive("ai.assist.outline-timeout", outlineTimeout);
        positive("ai.assist.completed-generation-ttl", completedGenerationTtl);
        for (String length : LENGTHS) {
            positive("ai.assist.draft-timeouts." + length, draftTimeouts == null ? null : draftTimeouts.get(length));
        }
        for (String kind : List.of("OUTLINE", "SHORT", "MEDIUM", "LONG")) {
            Integer tokens = maxCompletionTokens == null ? null : maxCompletionTokens.get(kind);
            if (tokens == null || tokens < 512 || tokens > 65536)
                throw new IllegalArgumentException(
                        "ai.assist.max-completion-tokens." + kind + " must be 512..65536");
        }
        positive("ai.assist.outline-per-day", outlinePerDay);
        positive("ai.assist.draft-per-day", draftPerDay);
        positive("ai.assist.burst-per-minute", burstPerMinute);
        draftTimeouts = Map.copyOf(draftTimeouts);
        maxCompletionTokens = Map.copyOf(maxCompletionTokens);
    }

    public int outlineTokens() {
        return maxCompletionTokens.get("OUTLINE");
    }

    public Duration longestDraftTimeout() {
        return LENGTHS.stream().map(draftTimeouts::get).max(Duration::compareTo).orElseThrow();
    }

    private static void positive(String name, Duration value) {
        if (value == null || value.isNegative() || value.isZero())
            throw new IllegalArgumentException(name + " must be a positive duration");
    }

    private static void positive(String name, int value) {
        if (value <= 0) throw new IllegalArgumentException(name + " must be positive");
    }
}
