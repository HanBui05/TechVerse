package com.techverse.server.dto.internal;

import java.util.List;
import java.util.UUID;

/** Structured output requested from the model; never returned to clients as-is. */
public record AiOutlineModelOutput(
        String title,
        String summary,
        UUID topicId,
        List<UUID> suggestedTagIds,
        List<AiOutlineSection> sections) {
    public record AiOutlineSection(String heading, List<String> subsections) {}
}
