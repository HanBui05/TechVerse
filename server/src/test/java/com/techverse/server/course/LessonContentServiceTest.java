package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.exception.*;
import com.techverse.server.service.impl.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

/** Course/lesson facade over the article Markdown validator: same rules, COURSE_* codes. */
class LessonContentServiceTest {
    final LessonContentService service = new LessonContentService(new ArticleContentService());

    @Test
    void validMarkdownPassesAndNullOrBlankMeansVideoOnly() {
        service.validateLesson("# Title\n\n[link](https://example.com) `code`");
        service.validateLesson(null);
        service.validateLesson("   ");
        assertThat(service.imageIssues(null, url -> true)).isEmpty();
    }

    @Test
    void rawHtmlAndDangerousLinksUseCourseCodes() {
        expect(ErrorCode.COURSE_CONTENT_INVALID, () -> service.validateLesson("<b>x</b>"));
        expect(ErrorCode.COURSE_CONTENT_INVALID, () -> service.validateLesson("[x](javascript:alert(1))"));
        expect(ErrorCode.COURSE_CONTENT_INVALID, () -> service.validateDescription("a\u0000b", null));
        expect(
                ErrorCode.COURSE_FILE_TOO_LARGE,
                () -> service.validateLesson("a".repeat(ArticleContentService.MAX_CONTENT_BYTES + 1)));
    }

    @Test
    void imageCapIsFiftyPerDocumentCoverIncluded() {
        String fifty = "![a](x.png)\n".repeat(50);
        service.validateLesson(fifty);
        expect(ErrorCode.COURSE_IMAGE_INVALID, () -> service.validateLesson(fifty + "![b](y.png)"));
        service.validateDescription(fifty, null);
        expect(ErrorCode.COURSE_IMAGE_INVALID, () -> service.validateDescription(fifty, "https://c/x.png"));
    }

    @Test
    void importMarkdownAndTextLikeArticles() {
        var md = service.importFile(file("lesson.md", "# Hi\n![a](local.png)"));
        assertThat(md.content()).isEqualTo("# Hi\n![a](local.png)");
        assertThat(md.imageIssues()).hasSize(1);
        var txt = service.importFile(file("notes.txt", "a*b"));
        assertThat(txt.content()).isEqualTo("a\\*b");
    }

    @Test
    void importErrorsAreTranslated() {
        expect(ErrorCode.COURSE_FILE_UNSUPPORTED, () -> service.importFile(file("x.pdf", "x")));
        expect(ErrorCode.COURSE_FILE_INVALID, () -> service.importFile(file("x.md", " ")));
        expect(
                ErrorCode.COURSE_FILE_INVALID,
                () -> service.importFile(new MockMultipartFile("file", "x.md", "text/markdown", new byte[] {(byte) 0xC3})));
        expect(
                ErrorCode.COURSE_FILE_TOO_LARGE,
                () -> service.importFile(file("x.md", "a".repeat(ArticleContentService.MAX_CONTENT_BYTES + 1))));
    }

    @Test
    void imageContextMapsSizeAndTypeToImageCodes() {
        var big = new CustomException(ErrorCode.ARTICLE_FILE_TOO_LARGE);
        assertThat(CourseErrors.translate(big, true).getErrorCode()).isEqualTo(ErrorCode.COURSE_IMAGE_TOO_LARGE);
        assertThat(CourseErrors.translate(big, false).getErrorCode()).isEqualTo(ErrorCode.COURSE_FILE_TOO_LARGE);
        var type = new CustomException(ErrorCode.ARTICLE_FILE_UNSUPPORTED);
        assertThat(CourseErrors.translate(type, true).getErrorCode()).isEqualTo(ErrorCode.COURSE_IMAGE_UNSUPPORTED);
        assertThat(CourseErrors.translate(new CustomException(ErrorCode.ARTICLE_RATE_LIMITED), true).getErrorCode())
                .isEqualTo(ErrorCode.COURSE_RATE_LIMITED);
        assertThat(CourseErrors.translate(new CustomException(ErrorCode.ACCESS_DENIED), true).getErrorCode())
                .isEqualTo(ErrorCode.ACCESS_DENIED);
    }

    private static MockMultipartFile file(String name, String text) {
        return new MockMultipartFile("file", name, "text/plain", text.getBytes(StandardCharsets.UTF_8));
    }

    private static void expect(ErrorCode code, Executable call) {
        assertThatThrownBy(call::execute)
                .isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(code));
    }
}
