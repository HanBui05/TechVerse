package com.techverse.server.dto.request;

import com.fasterxml.jackson.annotation.*;
import com.techverse.server.enums.AiArticleLength;
import com.techverse.server.exception.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import lombok.Getter;

import java.util.*;

/** The full input plus the Author-edited outline; nothing from an earlier call is trusted. */
@Getter
public class AiDraftRequest {
    @NotNull
    @Size(min = 5, max = 255)
    private String title;

    @NotNull
    @Size(min = 50, max = 500)
    private String summary;

    @NotNull private UUID topicId;

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

    @NotNull
    @Size(min = 3, max = 8)
    private List<@NotNull @Valid Section> sections;

    @Getter
    public static class Section {
        @NotNull
        @Size(min = 5, max = 120)
        private String heading;

        @Size(max = 4)
        private List<@NotNull @Size(min = 5, max = 120) String> subsections = List.of();

        @JsonSetter(value = "heading", nulls = Nulls.FAIL)
        public void setHeading(String v) {
            heading = v.strip();
        }

        @JsonSetter(value = "subsections", nulls = Nulls.FAIL)
        public void setSubsections(List<String> v) {
            subsections = v.stream().map(s -> s == null ? null : s.strip()).toList();
        }

        @JsonAnySetter
        public void rejectUnknown(String name, Object value) {
            throw new CustomException(ErrorCode.MALFORMED_REQUEST);
        }
    }

    @JsonSetter(value = "title", nulls = Nulls.FAIL)
    public void setTitle(String v) {
        title = v.strip();
    }

    @JsonSetter(value = "summary", nulls = Nulls.FAIL)
    public void setSummary(String v) {
        summary = v.strip();
    }

    @JsonSetter(value = "topicId", nulls = Nulls.FAIL)
    public void setTopicId(UUID v) {
        topicId = v;
    }

    @JsonSetter(value = "tagIds", nulls = Nulls.FAIL)
    public void setTagIds(List<UUID> v) {
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

    @JsonSetter(value = "sections", nulls = Nulls.FAIL)
    public void setSections(List<Section> v) {
        sections = new ArrayList<>(v);
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

    @JsonIgnore
    @AssertTrue(message = "Headings must be distinct")
    public boolean isDistinctHeadings() {
        if (sections == null) return true;
        var all =
                sections.stream()
                        .filter(Objects::nonNull)
                        .flatMap(s -> java.util.stream.Stream.concat(
                                java.util.stream.Stream.of(s.getHeading()), s.getSubsections().stream()))
                        .filter(Objects::nonNull)
                        .map(h -> h.toLowerCase(Locale.ROOT))
                        .toList();
        return new HashSet<>(all).size() == all.size();
    }

    /** Only call after validation. */
    @JsonIgnore
    public List<String> getH2Headings() {
        return sections.stream().map(Section::getHeading).toList();
    }
}
