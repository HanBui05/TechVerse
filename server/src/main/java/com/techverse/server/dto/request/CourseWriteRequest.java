package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.*;
import com.techverse.server.enums.ArticleAction;
import com.techverse.server.exception.*;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.*;

import lombok.Getter;

import java.util.*;

/** Course metadata only; there is no price field (free course, unknown fields are rejected). */
@Getter
@Schema(
        description =
                "SAVE keeps the draft; SUBMIT validates the whole tree and sends it for moderation."
                        + " Omitted PATCH fields are preserved; coverImageUrl=null clears the cover.")
public class CourseWriteRequest {
    @NotNull private ArticleAction action;

    @Size(max = 255)
    @Pattern(regexp = "(?s).*\\S.*")
    private String title;

    @Size(max = 500)
    private String summary;

    private String description;

    @Pattern(regexp = "BEGINNER|INTERMEDIATE|ADVANCED")
    @Schema(allowableValues = {"BEGINNER", "INTERMEDIATE", "ADVANCED"})
    private String level;

    private UUID topicId;

    @Size(max = 10)
    private List<@NotNull UUID> tagIds;

    @Size(max = 2048)
    private String coverImageUrl;

    @JsonIgnore private final Set<String> provided = new HashSet<>();

    @JsonSetter(value = "action", nulls = Nulls.FAIL)
    public void setAction(ArticleAction action) {
        this.action = action;
    }

    @JsonSetter(value = "title", nulls = Nulls.FAIL)
    public void setTitle(String v) {
        provided.add("title");
        title = v.strip();
    }

    @JsonSetter(value = "summary", nulls = Nulls.FAIL)
    public void setSummary(String v) {
        provided.add("summary");
        summary = v.strip();
    }

    @JsonSetter(value = "description", nulls = Nulls.FAIL)
    public void setDescription(String v) {
        provided.add("description");
        description = v;
    }

    @JsonSetter(value = "level", nulls = Nulls.FAIL)
    public void setLevel(String v) {
        provided.add("level");
        level = v;
    }

    @JsonSetter(value = "topicId", nulls = Nulls.FAIL)
    public void setTopicId(UUID v) {
        provided.add("topicId");
        topicId = v;
    }

    @JsonSetter(value = "tagIds", nulls = Nulls.FAIL)
    public void setTagIds(List<UUID> v) {
        provided.add("tagIds");
        tagIds = List.copyOf(v);
    }

    @JsonSetter("coverImageUrl")
    public void setCoverImageUrl(String v) {
        provided.add("coverImageUrl");
        coverImageUrl = v == null ? null : v.strip();
    }

    @JsonAnySetter
    public void rejectUnknown(String name, Object value) {
        throw new CustomException(ErrorCode.MALFORMED_REQUEST);
    }

    public boolean has(String name) {
        return provided.contains(name);
    }

    @JsonIgnore
    @AssertTrue(message = "Tag IDs must be distinct")
    public boolean isDistinctTags() {
        return tagIds == null || new HashSet<>(tagIds).size() == tagIds.size();
    }
}
