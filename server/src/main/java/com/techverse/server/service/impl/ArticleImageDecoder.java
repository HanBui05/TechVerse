package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.DecodedArticleImage;
import com.techverse.server.exception.*;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.util.*;

import javax.imageio.*;
import javax.imageio.stream.MemoryCacheImageInputStream;

@Service
public class ArticleImageDecoder {
    public static final int MAX_BYTES = 5 * 1024 * 1024;

    public DecodedArticleImage decode(MultipartFile file) {
        if (file.getSize() > MAX_BYTES) throw new CustomException(ErrorCode.ARTICLE_FILE_TOO_LARGE);
        try (var stream = file.getInputStream()) {
            byte[] source = stream.readNBytes(MAX_BYTES + 1);
            return decode(source);
        } catch (IOException e) {
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
        }
    }

    public DecodedArticleImage decode(byte[] source) {
        try {
            if (source.length > MAX_BYTES)
                throw new CustomException(ErrorCode.ARTICLE_FILE_TOO_LARGE);
            try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(source))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext())
                    throw new CustomException(ErrorCode.ARTICLE_FILE_UNSUPPORTED);
                ImageReader reader = readers.next();
                try {
                    String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                    if (!Set.of("png", "jpeg", "jpg", "webp").contains(format))
                        throw new CustomException(ErrorCode.ARTICLE_FILE_UNSUPPORTED);
                    reader.setInput(input, false, false);
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width < 1
                            || height < 1
                            || width > 8192
                            || height > 8192
                            || (long) width * height > 16_000_000)
                        throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
                    if (reader.getNumImages(true) > 1)
                        throw new CustomException(ErrorCode.ARTICLE_FILE_UNSUPPORTED);
                    // APNG is not consistently reported as animated by JDK readers.
                    if (format.equals("png") && containsChunk(source, "acTL"))
                        throw new CustomException(ErrorCode.ARTICLE_FILE_UNSUPPORTED);
                    var image = reader.read(0);
                    var normalized = new ByteArrayOutputStream();
                    ImageIO.write(image, "png", normalized);
                    if (normalized.size() > 20 * 1024 * 1024)
                        throw new CustomException(ErrorCode.ARTICLE_FILE_TOO_LARGE);
                    String hash =
                            HexFormat.of()
                                    .formatHex(
                                            java.security.MessageDigest.getInstance("SHA-256")
                                                    .digest(source));
                    return DecodedArticleImage.builder()
                            .bytes(normalized.toByteArray())
                            .fingerprint(hash)
                            .width(width)
                            .height(height)
                            .build();
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException | IllegalArgumentException e) {
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private boolean containsChunk(byte[] bytes, String name) {
        for (int offset = 8; offset + 12 <= bytes.length; ) {
            long size = Integer.toUnsignedLong(java.nio.ByteBuffer.wrap(bytes, offset, 4).getInt());
            if (name.equals(
                    new String(bytes, offset + 4, 4, java.nio.charset.StandardCharsets.US_ASCII)))
                return true;
            long next = offset + 12L + size;
            if (next > bytes.length) return false;
            offset = (int) next;
        }
        return false;
    }
}
