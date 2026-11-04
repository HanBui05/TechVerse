package com.techverse.server.author;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.dto.response.ArticleImageIssueResponse;
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

    @Test
    void imageIssuesCarrySourceOccurrencePositionAndFilename() {
        String text =
                "Intro\n\n"
                        + "![first](img/x.png) and ![second](img/x.png)\n"
                        + "![remote](https://cdn.example.com/p/y%20z.jpg?s=1)\n"
                        + "![ok](https://res.cloudinary.com/test/image/upload/v1/managed.png)\n"
                        + "```md\n![in code](code.png)\n```\n";
        var issues =
                content.imageIssues(text, url -> url.startsWith("https://res.cloudinary.com/"));
        assertThat(issues).hasSize(3);
        var first = issues.get(0);
        assertThat(first.type()).isEqualTo(ArticleImageIssueResponse.Type.LOCAL_FILE);
        assertThat(first.alt()).isEqualTo("first");
        assertThat(first.source()).isEqualTo("img/x.png");
        assertThat(first.occurrence()).isEqualTo(1);
        assertThat(first.line()).isEqualTo(3);
        assertThat(first.column()).isEqualTo(1);
        assertThat(first.filename()).isEqualTo("x.png");
        assertThat(issues.get(1).occurrence()).isEqualTo(2);
        assertThat(issues.get(1).column()).isEqualTo(25);
        var remote = issues.get(2);
        assertThat(remote.type()).isEqualTo(ArticleImageIssueResponse.Type.EXTERNAL_URL);
        assertThat(remote.line()).isEqualTo(4);
        assertThat(remote.filename()).isEqualTo("y z.jpg");
    }

    @Test
    void foreignCloudinaryImageIsAnUnmanagedAssetIssue() {
        var issues =
                content.imageIssues(
                        "![x](https://res.cloudinary.com/test/image/upload/v1/other.png)",
                        url -> false);
        assertThat(issues)
                .singleElement()
                .extracting(ArticleImageIssueResponse::type)
                .isEqualTo(ArticleImageIssueResponse.Type.UNMANAGED_ASSET);
    }

    @Test
    void occurrenceCountsEveryImageWithSameSourceIncludingManagedOnes() {
        // occurrence identifies the n-th image with this exact source in the document.
        var issues = content.imageIssues("![a](a.png)\n\n![b](a.png)", url -> false);
        assertThat(issues).extracting(ArticleImageIssueResponse::occurrence).containsExactly(1, 2);
    }

    @Test
    void draftContentMayKeepLocalOrExternalImagesButNotUnsafeSchemes() {
        assertThatCode(
                        () ->
                                content.validateContent(
                                        "![a](./a.png) ![b](http://example.com/b.png)"))
                .doesNotThrowAnyException();
        for (String text : new String[] {"![x](javascript:alert(1))", "![x](data:image/png;base64,AA)"})
            assertThatThrownBy(() -> content.validateContent(text))
                    .isInstanceOf(CustomException.class);
    }

    @Test
    void readingMinutesCountsTextAndCodeAtTwoHundredWordsPerMinute() {
        assertThat(content.readingMinutes("")).isEqualTo(1);
        assertThat(content.readingMinutes("# Hi\nshort text")).isEqualTo(1);
        String words = "word ".repeat(300);
        String code = "```java\n" + "int x; ".repeat(50) + "\n```";
        // 300 prose words + 100 code tokens = 400 words -> exactly 2 minutes; one more -> 3.
        assertThat(content.readingMinutes(words + "\n\n" + code)).isEqualTo(2);
        assertThat(content.readingMinutes(words + " extra\n\n" + code)).isEqualTo(3);
    }

    @Test
    void importReportsEveryImageAsIssueBecauseNothingIsUploadedYet() {
        var result =
                content.importFile(
                        file(
                                "readme.md",
                                "![a](./a.png)\n![b](https://res.cloudinary.com/test/image/upload/v1/x.png)"));
        assertThat(result.imageIssues()).hasSize(2);
    }

    private MockMultipartFile file(String name, String value) {
        return new MockMultipartFile(
                "file", name, "text/plain", value.getBytes(StandardCharsets.UTF_8));
    }
}
