package com.techverse.server.user;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.exception.CustomException;
import com.techverse.server.service.impl.GoogleAvatarDownloader;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class GoogleAvatarDownloaderTest {
    @ParameterizedTest
    @ValueSource(
            strings = {
                "http://lh3.googleusercontent.com/a/photo",
                "https://evil.example/a/photo",
                "https://lh3.googleusercontent.com.evil.example/a",
                "https://127.0.0.1/private",
                "https://lh3.googleusercontent.com:8443/a",
                "https://user@lh3.googleusercontent.com/a",
                "invalid"
            })
    void rejectsNonGoogleOrUnsafeUrlsBeforeNetwork(String url) {
        assertThatThrownBy(() -> new GoogleAvatarDownloader().download(url))
                .isInstanceOf(CustomException.class);
    }
}
