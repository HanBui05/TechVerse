package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.AiOutlineModelOutput;
import com.techverse.server.exception.CustomException;

import lombok.RequiredArgsConstructor;

import org.commonmark.node.*;
import org.commonmark.parser.Parser;

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

    /**
     * Full check of a finished draft against the approved H2 list; empty means valid. Size, raw
     * HTML and links follow {@link ArticleContentService#validateContent}.
     */
    public List<String> validateDraft(String text, List<String> expectedH2) {
        var errors = new ArrayList<String>();
        try {
            content.validateContent(text);
        } catch (CustomException e) {
            errors.add("content must be at most 1 MiB of Markdown without raw HTML or unsafe links");
            return errors;
        }
        if (!content.imageUrls(text).isEmpty()) errors.add("content must not contain images");
        var h2 = new ArrayList<String>();
        parser.parse(text)
                .accept(
                        new AbstractVisitor() {
                            @Override
                            public void visit(Heading heading) {
                                if (heading.getLevel() == 2) h2.add(normalize(plainText(heading)));
                                else if (heading.getLevel() != 3)
                                    errors.add("only ## and ### headings are allowed");
                                else if (h2.isEmpty())
                                    errors.add("### must come after a ## heading");
                            }

                            @Override
                            public void visit(FencedCodeBlock code) {
                                String info = code.getInfo() == null ? "" : code.getInfo().strip();
                                if (!CODE_LANGUAGE.matcher(info).matches())
                                    errors.add("every code fence needs a language");
                            }
                        });
        if (!h2.equals(expectedH2.stream().map(AiGeneratedContentValidator::normalize).toList()))
            errors.add("## headings must match the outline in count and order");
        return errors;
    }

    private static final java.util.regex.Pattern CODE_LANGUAGE =
            java.util.regex.Pattern.compile("[A-Za-z0-9_+#.-]{1,32}");
    private static final java.util.regex.Pattern NUMBERING =
            java.util.regex.Pattern.compile("^(\\d+|[ivxlcdm]+)[.)]\\s*");
    private final Parser parser = Parser.builder().build();

    /** trim → lowercase → drop "1." / "1)" / "I." prefix → drop punctuation → collapse spaces. */
    static String normalize(String heading) {
        String s = NUMBERING.matcher(heading.strip().toLowerCase(Locale.ROOT)).replaceFirst("");
        return s.replaceAll("\\p{P}+", " ").replaceAll("\\s+", " ").strip();
    }

    private static String plainText(Node node) {
        var out = new StringBuilder();
        node.accept(
                new AbstractVisitor() {
                    @Override
                    public void visit(Text text) {
                        out.append(text.getLiteral());
                    }

                    @Override
                    public void visit(Code code) {
                        out.append(code.getLiteral());
                    }
                });
        return out.toString();
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
