package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.AiOutlineModelOutput;
import com.techverse.server.exception.CustomException;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Component;

import java.util.*;

/** Pure checks on model output; violations are reported, never silently repaired. */
@Component
@RequiredArgsConstructor
public class AiGeneratedContentValidator {
    static final int MAX_SUGGESTED_TAGS = 5;

    private final ArticleContentService content;

    /** Returns human-readable violations (fed to the repair prompt); empty means valid. */
    public List<String> validateOutline(
            AiOutlineModelOutput o, UUID topicId, List<UUID> tagIds, Set<UUID> activeTags) {
        var errors = new ArrayList<String>();
        text(errors, "title", o.title(), 5, 255);
        text(errors, "summary", o.summary(), 50, 500);
        if (!topicId.equals(o.topicId())) errors.add("topicId must equal the selected topic");

        List<UUID> suggested = o.suggestedTagIds();
        if (suggested == null || hasNull(suggested)) {
            errors.add("suggestedTagIds must be a list of tag IDs");
        } else {
            if (suggested.size() > MAX_SUGGESTED_TAGS)
                errors.add("suggestedTagIds must contain at most " + MAX_SUGGESTED_TAGS + " IDs");
            if (new HashSet<>(suggested).size() != suggested.size())
                errors.add("suggestedTagIds must be distinct");
            if (!activeTags.containsAll(suggested))
                errors.add("suggestedTagIds must come from activeTags");
            if (suggested.stream().anyMatch(tagIds::contains))
                errors.add("suggestedTagIds must not repeat the selected tagIds");
        }

        var sections = o.sections();
        if (sections == null || hasNull(sections)) {
            errors.add("sections must be a list");
            return errors;
        }
        if (sections.size() < 3 || sections.size() > 8)
            errors.add("sections must contain 3 to 8 H2 entries");
        var seen = new HashSet<String>();
        for (int i = 0; i < sections.size(); i++) {
            var s = sections.get(i);
            heading(errors, seen, "sections[" + i + "].heading", s.heading());
            if (s.subsections() == null || hasNull(s.subsections())) {
                errors.add("sections[" + i + "].subsections must be a list");
                continue;
            }
            if (s.subsections().size() > 4)
                errors.add("sections[" + i + "] must have at most 4 H3 entries");
            for (int j = 0; j < s.subsections().size(); j++)
                heading(errors, seen, "sections[" + i + "].subsections[" + j + "]", s.subsections().get(j));
        }
        return errors;
    }

    private void heading(List<String> errors, Set<String> seen, String field, String value) {
        if (!text(errors, field, value, 5, 120)) return;
        if (!seen.add(value.strip().toLowerCase(Locale.ROOT)))
            errors.add(field + " duplicates another heading");
    }

    /** Length is checked on the stripped value; returns whether the value was usable. */
    private boolean text(List<String> errors, String field, String value, int min, int max) {
        if (value == null) {
            errors.add(field + " is required");
            return false;
        }
        int length = value.strip().length();
        if (length < min || length > max) {
            errors.add(field + " must be " + min + " to " + max + " characters");
            return false;
        }
        if (!plain(value)) {
            errors.add(field + " must not contain raw HTML or images");
            return false;
        }
        return true;
    }

    private static boolean hasNull(List<?> list) {
        return list.stream().anyMatch(Objects::isNull);
    }

    private boolean plain(String value) {
        try {
            content.validateContent(value);
        } catch (CustomException e) {
            return false;
        }
        return content.imageUrls(value).isEmpty();
    }
}
