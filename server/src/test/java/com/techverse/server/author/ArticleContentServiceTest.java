package com.techverse.server.author;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.exception.CustomException;
import com.techverse.server.service.impl.ArticleContentService;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

class ArticleContentServiceTest {
    private final ArticleContentService content = new ArticleContentService();

    @Test
    void markdownImportPreservesCodeAndRemovesOnlyBom() {
        String source = "# Title\n```java\n  int i = 1;\n<script>example</script>\n```\n";
        assertThat(content.importFile(file("readme.md", "\uFEFF" + source)).content())
                .isEqualTo(source);
    }

    @Test
    void textImportDoesNotInventFormattingOrInterpretLinks() {
        String result =
                content.importFile(
                                file("notes.txt", "# literal\n![not an image](local.png)\n  text"))
                        .content();
        assertThat(content.imageUrls(result)).isEmpty();
        assertThat(result).contains("\\# literal");
    }

    @Test
    void imagesInCodeAreNotReferencesButReferenceStyleImagesAre() {
        assertThat(
                        content.imageUrls(
                                "```md\n"
                                        + "![fake](file.png)\n"
                                        + "```\n"
                                        + "![real][photo]\n\n"
                                        + "[photo]: https://example.com/a.png"))
                .containsExactly("https://example.com/a.png");
    }

    @Test
    void unsafeLinksAndRawHtmlAreRejectedWithoutDamagingTutorialCode() {
        for (String text :
                new String[] {
                    "[x](javascript:alert%281%29)",
                    "<script>alert(1)</script>",
                    "<img src=x onerror=alert(1)>"
                })
            assertThatThrownBy(() -> content.validateContent(text))
                    .isInstanceOf(CustomException.class);
        assertThatCode(
                        () ->
                                content.validateContent(
                                        "```html\n"
                                                + "<script>alert(1)</script>\n"
                                                + "```\n"
                                                + "[docs](https://example.com)"))
                .doesNotThrowAnyException();
    }

    @Test
    void invalidEncodingBinaryEmptyWrongExtensionAndOversizeFail() {
        for (var f :
                new MockMultipartFile[] {
                    file("empty.md", " "),
                    file("evil.exe", "text"),
                    file("binary.md", "a\0b"),
                    new MockMultipartFile(
                            "file", "bad.md", "text/plain", new byte[] {(byte) 0xC3, 0x28}),
                    file("large.md", "x".repeat(1048577))
                })
            assertThatThrownBy(() -> content.importFile(f)).isInstanceOf(CustomException.class);
    }

    @Test
    void unresolvedLocalImagesAreReportedWithoutCreatingAnArticle() {
        assertThat(content.importFile(file("readme.md", "![photo](./photo.png)")).warnings())
                .isNotEmpty();
    }

    private MockMultipartFile file(String name, String value) {
        return new MockMultipartFile(
                "file", name, "text/plain", value.getBytes(StandardCharsets.UTF_8));
    }
}
