package com.techverse.server.service.impl;

import com.techverse.server.dto.response.ArticleImportResponse;
import com.techverse.server.exception.*;

import org.commonmark.node.*;
import org.commonmark.parser.Parser;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;

@Service
public class ArticleContentService {
    public static final int MAX_CONTENT_BYTES = 1024 * 1024;
    private final Parser parser = Parser.builder().build();

    public ArticleImportResponse importFile(MultipartFile file) {
        if (file.getSize() > MAX_CONTENT_BYTES)
            throw new CustomException(ErrorCode.ARTICLE_FILE_TOO_LARGE);
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("");
        String lower = name.toLowerCase(Locale.ROOT);
        if (!lower.endsWith(".md") && !lower.endsWith(".txt"))
            throw new CustomException(ErrorCode.ARTICLE_FILE_UNSUPPORTED);
        String text;
        try {
            byte[] bytes = file.getInputStream().readNBytes(MAX_CONTENT_BYTES + 1);
            if (bytes.length > MAX_CONTENT_BYTES)
                throw new CustomException(ErrorCode.ARTICLE_FILE_TOO_LARGE);
            text =
                    StandardCharsets.UTF_8
                            .newDecoder()
                            .onMalformedInput(CodingErrorAction.REPORT)
                            .onUnmappableCharacter(CodingErrorAction.REPORT)
                            .decode(ByteBuffer.wrap(bytes))
                            .toString();
        } catch (IOException e) {
            throw new CustomException(ErrorCode.ARTICLE_FILE_INVALID);
        }
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        if (text.isBlank()
                || text.chars()
                        .anyMatch(c -> c == 0 || (c < 32 && c != '\n' && c != '\r' && c != '\t')))
            throw new CustomException(ErrorCode.ARTICLE_FILE_INVALID);
        if (lower.endsWith(".txt")) text = escapePlainText(text);
        var warnings =
                imageUrls(text).stream()
                        .filter(url -> !url.startsWith("https://"))
                        .map(url -> "Image must be uploaded and its path replaced: " + url)
                        .toList();
        // Only a display filename is returned; never use it as a filesystem path.
        String safeName = name.replace('\\', '/');
        safeName = safeName.substring(safeName.lastIndexOf('/') + 1);
        return ArticleImportResponse.builder()
                .filename(safeName)
                .content(text)
                .warnings(warnings)
                .build();
    }

    public List<String> imageUrls(String text) {
        var urls = new ArrayList<String>();
        parser.parse(text)
                .accept(
                        new AbstractVisitor() {
                            @Override
                            public void visit(Image image) {
                                urls.add(image.getDestination());
                                visitChildren(image);
                            }
                        });
        return urls;
    }

    public void validateContent(String text) {
        if (text.getBytes(StandardCharsets.UTF_8).length > MAX_CONTENT_BYTES)
            throw new CustomException(ErrorCode.ARTICLE_FILE_TOO_LARGE);
        if (text.indexOf(0) >= 0) throw new CustomException(ErrorCode.ARTICLE_CONTENT_INVALID);
        parser.parse(text)
                .accept(
                        new AbstractVisitor() {
                            @Override
                            public void visit(HtmlBlock html) {
                                invalid();
                            }

                            @Override
                            public void visit(HtmlInline html) {
                                invalid();
                            }

                            @Override
                            public void visit(Link link) {
                                String url = link.getDestination();
                                if (!safeLink(url)) invalid();
                                visitChildren(link);
                            }

                            @Override
                            public void visit(Image image) {
                                if (!image.getDestination().startsWith("https://")) invalid();
                            }

                            private void invalid() {
                                throw new CustomException(ErrorCode.ARTICLE_CONTENT_INVALID);
                            }
                        });
    }

    private boolean safeLink(String url) {
        if (url.chars().anyMatch(c -> c <= 32 || c == 127)
                || url.startsWith("//")
                || url.indexOf('\\') >= 0) return false;
        try {
            var uri = java.net.URI.create(url);
            String scheme = uri.getScheme();
            return scheme == null
                    || Set.of("https", "http", "mailto").contains(scheme.toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private String escapePlainText(String text) {
        var result = new StringBuilder();
        for (char c : text.toCharArray()) {
            if ("\\`*_{}[]<>()#+-.!|~>".indexOf(c) >= 0) result.append('\\');
            result.append(c);
        }
        return result.toString();
    }
}
