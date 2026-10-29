package com.techverse.server.author;

import static org.assertj.core.api.Assertions.*;

import com.techverse.server.exception.CustomException;
import com.techverse.server.service.impl.ArticleImageDecoder;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import javax.imageio.ImageIO;

class ArticleImageDecoderTest {
    private final ArticleImageDecoder decoder = new ArticleImageDecoder();

    @Test
    void realPngIsNormalizedAndCannotTrustTheFilename() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var image =
                decoder.decode(
                        new MockMultipartFile(
                                "file",
                                "../../evil.svg",
                                "application/octet-stream",
                                bytes.toByteArray()));
        assertThat(image.width()).isEqualTo(2);
        assertThat(image.height()).isEqualTo(3);
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(image.bytes())).getWidth())
                .isEqualTo(2);
    }

    @Test
    void fakeImageSvgAndOversizeFail() {
        for (var file :
                new MockMultipartFile[] {
                    file("<svg></svg>".getBytes()),
                    file(new byte[0]),
                    file(new byte[5 * 1024 * 1024 + 1])
                })
            assertThatThrownBy(() -> decoder.decode(file)).isInstanceOf(CustomException.class);
    }

    @Test
    void excessiveDimensionsAreRejectedBeforeDecodingPixels() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(8193, 1, BufferedImage.TYPE_INT_RGB), "png", bytes);
        assertThatThrownBy(() -> decoder.decode(file(bytes.toByteArray())))
                .isInstanceOf(CustomException.class);
    }

    private MockMultipartFile file(byte[] bytes) {
        return new MockMultipartFile("file", "image.png", "image/png", bytes);
    }
}
