package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.*;
import com.techverse.server.exception.*;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.*;

import lombok.Getter;

import java.util.*;

/**
 * A lesson needs a YouTube video or Markdown content. On PATCH omitted fields are kept and
 * summary/content/videoUrl may be null to clear them. Only provider + video ID are stored.
 */
@Getter
@Schema(description = "Create or partially update a lesson; videoUrl accepts HTTPS YouTube links only")
public class LessonWriteRequest {
    @Size(max = 255)
    @Pattern(regexp = "(?s).*\\S.*")
    private String title;

    @Size(max = 500)
    private String summary;

    private String content;

    @Size(max = 2048)
    private String videoUrl;

    private Boolean preview;

    private UUID aiGenerationId;

    @JsonIgnore private final Set<String> provided = new HashSet<>();

    @JsonSetter(value = "title", nulls = Nulls.FAIL)
    public void setTitle(String v) {
        provided.add("title");
        title = v.strip();
    }

    @JsonSetter("summary")
    public void setSummary(String v) {
        provided.add("summary");
        summary = v == null || v.isBlank() ? null : v.strip();
    }

    @JsonSetter("content")
    public void setContent(String v) {
        provided.add("content");
        content = v;
    }

    @JsonSetter("videoUrl")
    public void setVideoUrl(String v) {
        provided.add("videoUrl");
        videoUrl = v == null ? null : v.strip();
    }

    @JsonSetter(value = "preview", nulls = Nulls.FAIL)
    public void setPreview(Boolean v) {
        provided.add("preview");
        preview = v;
    }

    @JsonSetter(value = "aiGenerationId", nulls = Nulls.FAIL)
    public void setAiGenerationId(UUID v) {
        provided.add("aiGenerationId");
        aiGenerationId = v;
    }

    @JsonAnySetter
    public void rejectUnknown(String name, Object value) {
        throw new CustomException(ErrorCode.MALFORMED_REQUEST);
    }

    public boolean has(String name) {
        return provided.contains(name);
    }
}
