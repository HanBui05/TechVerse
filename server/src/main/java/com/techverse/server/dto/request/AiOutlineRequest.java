package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.*;
import com.techverse.server.enums.AiArticleLength;
import com.techverse.server.exception.*;

import jakarta.validation.constraints.*;

import lombok.Getter;

import java.util.*;

@Getter
@AiTarget
public class AiOutlineRequest implements AiTarget.Request {
    @Pattern(regexp = "ARTICLE|LESSON")
    private String targetType = "ARTICLE";

    private UUID courseId;

    @JsonIgnore private final Set<String> provided = new HashSet<>();

    @Size(min = 5, max = 255)
    private String title;

    private UUID topicId;

    @Size(max = 10)
    private List<@NotNull UUID> tagIds = List.of();

    @NotNull
    @Size(min = 20, max = 4000)
    private String idea;

    // Kept as text so an unknown value is a field VALIDATION_ERROR, not an unreadable body.
    @NotNull
    @Pattern(regexp = "SHORT|MEDIUM|LONG")
    private String length;

    @NotNull
    @Size(min = 3, max = 200)
    private String targetAudience;

    @JsonSetter(value = "title", nulls = Nulls.FAIL)
    public void setTitle(String v) {
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
        // ArrayList, not List.copyOf: a null element must reach @NotNull, not throw here.
        tagIds = new ArrayList<>(v);
    }

    @JsonSetter(value = "idea", nulls = Nulls.FAIL)
    public void setIdea(String v) {
        idea = v.strip();
    }

    @JsonSetter(value = "length", nulls = Nulls.FAIL)
    public void setLength(String v) {
        length = v;
    }

    /** Only call after validation. */
    public AiArticleLength getLength() {
        return AiArticleLength.valueOf(length);
    }

    @JsonSetter(value = "targetAudience", nulls = Nulls.FAIL)
    public void setTargetAudience(String v) {
        targetAudience = v.strip();
    }

    @JsonSetter(value = "targetType", nulls = Nulls.FAIL)
    public void setTargetType(String v) {
        targetType = v;
    }

    @JsonSetter(value = "courseId", nulls = Nulls.FAIL)
    public void setCourseId(UUID v) {
        courseId = v;
    }

    @Override
    public boolean has(String field) {
        return provided.contains(field);
    }

    @JsonAnySetter
    public void rejectUnknown(String name, Object value) {
        throw new CustomException(ErrorCode.MALFORMED_REQUEST);
    }

    @JsonIgnore
    @AssertTrue(message = "Tag IDs must be distinct")
    public boolean isDistinctTags() {
        return new HashSet<>(tagIds).size() == tagIds.size();
    }
}
