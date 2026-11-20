package com.techverse.server.interview;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.exception.*;
import com.techverse.server.service.impl.ArticleContentService;
import com.techverse.server.service.impl.AuthorInterviewService;

import org.junit.jupiter.api.Test;

/** Markdown rules for question, sample answer and hint: article checks plus no image node at all. */
class InterviewContentTest {
    final AuthorInterviewService service = new AuthorInterviewService(null, new ArticleContentService(), null, null, null, null);

    @Test
    void plainMarkdownPasses() {
        assertThatCode(() -> service.checkContent("**JVM** chạy `bytecode`.\n\n```java\nint x = 1;\n```", "[docs](https://openjdk.org)", null, ""))
                .doesNotThrowAnyException();
    }

    @Test
    void rawHtmlDangerousLinksNulAndEveryImageAreRejected() {
        for (String bad : new String[] {
                "<script>alert(1)</script>",
                "Xem <b>đậm</b>",
                "[click](javascript:alert(1))",
                "a\u0000b",
                "![pic](https://example.com/a.png)",
                "![pic][ref]\n\n[ref]: https://example.com/a.png",
                "![]()"})
            assertThatThrownBy(() -> service.checkContent("Valid question text", bad, null))
                    .as(bad)
                    .isInstanceOfSatisfying(CustomException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INTERVIEW_CONTENT_INVALID));
    }
}
