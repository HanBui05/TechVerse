package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.*;
import com.techverse.server.enums.ArticleAction;
import com.techverse.server.exception.*;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.*;

import lombok.Getter;

import java.util.*;

@Getter
@Schema(
        description =
                "SAVE preserves draft status; SUBMIT validates final merged data and sends for"
                        + " moderation. Omitted PATCH fields are preserved.")
public class ArticleWriteRequest {
    @NotNull private ArticleAction action;

    @Size(max = 255)
    @Pattern(regexp = "(?s).*\\S.*")
    private String title;

    private UUID topicId;

    @Size(max = 10)
    private List<@NotNull UUID> tagIds;

    @Size(max = 500)
    private String summary;

    private String content;

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

    @JsonSetter(value = "summary", nulls = Nulls.FAIL)
    public void setSummary(String v) {
        provided.add("summary");
        summary = v.strip();
    }

    @JsonSetter(value = "content", nulls = Nulls.FAIL)
    public void setContent(String v) {
        provided.add("content");
        content = v;
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
