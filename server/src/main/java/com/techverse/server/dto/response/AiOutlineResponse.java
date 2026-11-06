package com.techverse.server.dto.response;

import java.util.List;
import java.util.UUID;

/** Built from validated model output; tagIds are the Author's own selection, unchanged. */
public record AiOutlineResponse(
        String title,
        String summary,
        UUID topicId,
        List<UUID> tagIds,
        List<UUID> suggestedTagIds,
        List<Section> sections) {
    public record Section(String heading, List<String> subsections) {}
}
