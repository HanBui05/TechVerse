package com.techverse.server.author;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.techverse.server.service.impl.ArticleContentService;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class ArticleSeedFixtureTest {
    private final ArticleContentService contentService = new ArticleContentService();
    private final ObjectMapper mapper = new ObjectMapper();

    // Giữ số lượng, giới hạn và tính duy nhất của dữ liệu đúng hợp đồng tạo topic/tag.
    @Test
    void taxonomyHasValidDistinctNamesAndDescriptions() throws IOException {
        assertThat(taxonomyNames("topics.json", 24)).hasSize(24);
        assertThat(taxonomyNames("tags.json", 96)).hasSize(96);
    }

    // Đưa từng file thật qua cả import UTF-8 và validation Markdown của backend.
    @TestFactory
    Stream<DynamicTest> everyArticleCanBeImportedAndReferencesKnownTaxonomy() throws IOException {
        JsonNode manifest = json("articles.json");
        assertThat(manifest.size()).isEqualTo(24);
        Set<String> topics = taxonomyNames("topics.json", 24);
        Set<String> tags = taxonomyNames("tags.json", 96);
        Set<String> filenames = new HashSet<>();

        return StreamSupport.stream(manifest.spliterator(), false)
                .map(article -> DynamicTest.dynamicTest(article.get("file").asString(), () -> {
                    String filename = article.get("file").asString();
                    assertThat(filenames.add(filename)).isTrue();
                    assertThat(filename).matches("articles/[a-z0-9-]+\\.md");
                    byte[] bytes;
                    try (InputStream input = resource(filename)) {
                        bytes = input.readAllBytes();
                    }
                    assertThat(bytes.length).isBetween(1, ArticleContentService.MAX_CONTENT_BYTES);
                    var imported = contentService.importFile(new MockMultipartFile(
                            "file", filename, "text/markdown", bytes));
                    String text = new String(bytes, StandardCharsets.UTF_8);
                    assertThat(imported.content()).isEqualTo(text)
                            .startsWith("# " + article.get("title").asString() + "\n")
                            .contains("```", "## Lỗi thường gặp", "## Bài tập thực hành");
                    assertThat(imported.warnings()).isEmpty();
                    assertThat(contentService.imageUrls(text)).isEmpty();
                    assertThatCode(() -> contentService.validateContent(text)).doesNotThrowAnyException();
                    assertThat(article.get("title").asString().length()).isBetween(1, 255);
                    assertThat(article.get("summary").asString().length()).isBetween(1, 500);
                    assertThat(topics).contains(article.get("topicName").asString().toLowerCase(Locale.ROOT));
                    assertThat(article.get("tagNames").size()).isBetween(1, 10);
                    Set<String> selectedTags = new HashSet<>();
                    for (JsonNode tag : article.get("tagNames")) {
                        String name = tag.asString().toLowerCase(Locale.ROOT);
                        assertThat(tags).contains(name);
                        assertThat(selectedTags.add(name)).isTrue();
                    }
                }));
    }

    // Kiểm tra tên không trùng bất kể hoa thường, đồng thời không vượt giới hạn DTO.
    private Set<String> taxonomyNames(String filename, int expected) throws IOException {
        JsonNode values = json(filename);
        assertThat(values.size()).isEqualTo(expected);
        Set<String> result = new HashSet<>();
        for (JsonNode item : values) {
            String name = item.get("name").asString();
            assertThat(name).isNotBlank().isEqualTo(name.strip());
            assertThat(name.length()).isLessThanOrEqualTo(100);
            assertThat(item.get("description").asString().length()).isLessThanOrEqualTo(500);
            assertThat(result.add(name.toLowerCase(Locale.ROOT))).isTrue();
        }
        return result;
    }

    // Đọc JSON từ classpath để test không phụ thuộc thư mục chạy Gradle.
    private JsonNode json(String filename) throws IOException {
        try (InputStream input = resource(filename)) {
            return mapper.readTree(input);
        }
    }

    // Fail rõ ràng nếu metadata trỏ tới fixture bị thiếu.
    private InputStream resource(String filename) {
        InputStream input = getClass().getResourceAsStream("/seed/" + filename);
        assertThat(input).as("Missing seed fixture: %s", filename).isNotNull();
        return input;
    }
}
