package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.exception.*;
import com.techverse.server.service.impl.LessonVideoParser;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class LessonVideoParserTest {
    static final String ID = "dQw4w9WgXcQ";

    @ParameterizedTest
    @ValueSource(
            strings = {
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "https://youtube.com/watch?v=dQw4w9WgXcQ",
                "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
                "https://youtu.be/dQw4w9WgXcQ",
                "https://www.youtube.com/shorts/dQw4w9WgXcQ",
                "https://www.youtube.com/embed/dQw4w9WgXcQ",
                "  https://youtu.be/dQw4w9WgXcQ  "
            })
    void acceptsAllowlistedForms(String url) {
        assertThat(LessonVideoParser.youtubeId(url)).isEqualTo(ID);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123",
                "https://www.youtube.com/playlist?list=PL123",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
                "https://youtu.be/dQw4w9WgXcQ?t=30",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=30",
                "https://www.youtube.com/embed/dQw4w9WgXcQ?start=5",
                "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
                "https://evilyoutube.com/watch?v=dQw4w9WgXcQ",
                "https://user@www.youtube.com/watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=short",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQx",
                "https://www.youtube.com/watch?v=dQw4w9Wg*cQ",
                "https://www.youtube.com/watch",
                "https://www.youtube.com/channel/dQw4w9WgXcQ",
                "https://youtu.be/",
                "javascript:alert(1)",
                "not a url",
                ""
            })
    void rejectsEverythingElse(String url) {
        assertThatThrownBy(() -> LessonVideoParser.youtubeId(url))
                .isInstanceOfSatisfying(
                        CustomException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LESSON_VIDEO_INVALID));
    }

    @Test
    void rejectsNull() {
        assertThatThrownBy(() -> LessonVideoParser.youtubeId(null)).isInstanceOf(CustomException.class);
    }
}
