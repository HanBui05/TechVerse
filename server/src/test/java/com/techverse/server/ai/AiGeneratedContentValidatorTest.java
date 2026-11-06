package com.techverse.server.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.techverse.server.dto.internal.AiOutlineModelOutput;
import com.techverse.server.dto.internal.AiOutlineModelOutput.AiOutlineSection;
import com.techverse.server.service.impl.AiGeneratedContentValidator;
import com.techverse.server.service.impl.ArticleContentService;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class AiGeneratedContentValidatorTest {
  static final UUID TOPIC = UUID.randomUUID();
  static final UUID CHOSEN = UUID.randomUUID();
  static final UUID ALLOWED = UUID.randomUUID();

  final AiGeneratedContentValidator validator =
      new AiGeneratedContentValidator(new ArticleContentService());

  static AiOutlineSection section(int i) {
    return new AiOutlineSection("Phần số " + i + " của bài", List.of("Ý con thứ nhất " + i));
  }

  static AiOutlineModelOutput outline(String title, String summary, List<AiOutlineSection> sections) {
    return new AiOutlineModelOutput(title, summary, TOPIC, List.of(ALLOWED), sections);
  }

  static List<AiOutlineSection> sections(int n) {
    return IntStream.rangeClosed(1, n).mapToObj(AiGeneratedContentValidatorTest::section).toList();
  }

  List<String> check(AiOutlineModelOutput o) {
    return validator.validateOutline(o, TOPIC, List.of(CHOSEN), Set.of(CHOSEN, ALLOWED));
  }

  @Test
  void validOutlineAtBoundariesHasNoErrors() {
    assertThat(check(outline("a".repeat(5), "s".repeat(50), sections(3)))).isEmpty();
    assertThat(check(outline("a".repeat(255), "s".repeat(500), sections(8)))).isEmpty();
  }

  @Test
  void titleAndSummaryLengthsOutsideBoundsAreErrors() {
    assertThat(check(outline("a".repeat(4), "s".repeat(50), sections(3)))).hasSize(1);
    assertThat(check(outline("a".repeat(256), "s".repeat(50), sections(3)))).hasSize(1);
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(49), sections(3)))).hasSize(1);
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(501), sections(3)))).hasSize(1);
  }

  @Test
  void sectionCountMustBeThreeToEight() {
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), sections(2)))).isNotEmpty();
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), sections(9)))).isNotEmpty();
  }

  @Test
  void subsectionCountAndHeadingLengthsAreBounded() {
    var list = new ArrayList<>(sections(3));
    list.set(0, new AiOutlineSection("Mục có bốn ý", List.of("Ý con 1", "Ý con 2", "Ý con 3", "Ý con 4")));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).isEmpty();

    list.set(0, new AiOutlineSection("Mục có năm ý", List.of("Ý con 1", "Ý con 2", "Ý con 3", "Ý con 4", "Ý con 5")));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).isNotEmpty();

    list.set(0, new AiOutlineSection("abcd", List.of()));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).isNotEmpty();

    list.set(0, new AiOutlineSection("h".repeat(120), List.of("x".repeat(121))));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).hasSize(1);
  }

  @Test
  void duplicateHeadingsAfterTrimAndLowercaseAreErrors() {
    var list = new ArrayList<>(sections(3));
    list.set(1, new AiOutlineSection("  PHẦN SỐ 1 CỦA BÀI ", List.of()));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).isNotEmpty();

    list.set(1, new AiOutlineSection("Mục khác hẳn", List.of("Ý con thứ nhất 1")));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).isNotEmpty();
  }

  @Test
  void rawHtmlAndImageSyntaxAreErrors() {
    assertThat(check(outline("Tiêu đề <b>đậm</b>", "s".repeat(60), sections(3)))).isNotEmpty();
    assertThat(check(outline("Tiêu đề ổn", "Tóm tắt ![x](https://a.b/c.png) " + "s".repeat(50), sections(3))))
        .isNotEmpty();
    var list = new ArrayList<>(sections(3));
    list.set(2, new AiOutlineSection("Mục <script>x</script>", List.of()));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).isNotEmpty();
  }

  @Test
  void topicMustMatchAndSuggestionsComeFromAllowlistWithoutChosenTags() {
    var other = new AiOutlineModelOutput("Tiêu đề ổn", "s".repeat(60), UUID.randomUUID(), List.of(), sections(3));
    assertThat(check(other)).isNotEmpty();

    var unknown = new AiOutlineModelOutput("Tiêu đề ổn", "s".repeat(60), TOPIC, List.of(UUID.randomUUID()), sections(3));
    assertThat(check(unknown)).isNotEmpty();

    var chosen = new AiOutlineModelOutput("Tiêu đề ổn", "s".repeat(60), TOPIC, List.of(CHOSEN), sections(3));
    assertThat(check(chosen)).isNotEmpty();

    var dup = new AiOutlineModelOutput("Tiêu đề ổn", "s".repeat(60), TOPIC, List.of(ALLOWED, ALLOWED), sections(3));
    assertThat(check(dup)).isNotEmpty();
  }

  @Test
  void moreThanFiveSuggestionsIsAnError() {
    var many = IntStream.range(0, 6).mapToObj(i -> UUID.randomUUID()).toList();
    var o = new AiOutlineModelOutput("Tiêu đề ổn", "s".repeat(60), TOPIC, many, sections(3));
    assertThat(validator.validateOutline(o, TOPIC, List.of(), Set.copyOf(many))).isNotEmpty();
  }

  @Test
  void nullFieldsAreErrorsNotExceptions() {
    assertThat(check(new AiOutlineModelOutput(null, null, null, null, null))).isNotEmpty();
    var list = new ArrayList<AiOutlineSection>(sections(3));
    list.set(0, new AiOutlineSection(null, null));
    assertThat(check(outline("Tiêu đề ổn", "s".repeat(60), list))).isNotEmpty();
  }

  // ---- Draft ----

  static final List<String> H2 = List.of("JWT giải quyết vấn đề gì?", "Refresh token", "Kết luận");

  static String draft(String extra) {
    return """
        Mở bài ngắn.

        ## JWT giải quyết vấn đề gì?

        Nội dung [tài liệu](https://example.com/jwt).

        ### Cấu trúc token

        ```java
        String token = jwt();
        ```

        ## Refresh token

        Đoạn văn.

        ## Kết luận

        Hết.
        """ + extra;
  }

  List<String> checkDraft(String content) {
    return validator.validateDraft(content, H2);
  }

  @Test
  void validDraftHasNoErrors() {
    assertThat(checkDraft(draft(""))).isEmpty();
  }

  @Test
  void rawHtmlImagesAndUnsafeLinksAreErrors() {
    assertThat(checkDraft(draft("\n<div>x</div>\n"))).isNotEmpty();
    assertThat(checkDraft(draft("\nChữ <b>đậm</b>.\n"))).isNotEmpty();
    assertThat(checkDraft(draft("\n![ảnh](https://example.com/a.png)\n"))).isNotEmpty();
    assertThat(checkDraft(draft("\n[x](javascript:alert(1))\n"))).isNotEmpty();
  }

  @Test
  void onlyH2AndH3AreAllowedAndH3NeedsAPrecedingH2() {
    assertThat(checkDraft("# Tiêu đề\n\n" + draft(""))).isNotEmpty();
    assertThat(checkDraft(draft("\n#### Sâu quá\n"))).isNotEmpty();
    assertThat(checkDraft("### Mồ côi\n\n" + draft(""))).isNotEmpty();
  }

  @Test
  void h2MatchingIgnoresNumberingCasePunctuationAndSpacing() {
    String numbered = draft("")
        .replace("## JWT giải quyết vấn đề gì?", "## 1. jwt  GIẢI QUYẾT vấn đề gì")
        .replace("## Refresh token", "## II. Refresh token:")
        .replace("## Kết luận", "## 3) Kết luận!");
    assertThat(checkDraft(numbered)).isEmpty();
  }

  @Test
  void wrongH2CountOrOrderIsAnError() {
    assertThat(checkDraft(draft("\n## Mục thừa\n"))).isNotEmpty();
    assertThat(checkDraft(draft("").replace("## Kết luận", "Kết luận"))).isNotEmpty();
    String swapped = draft("")
        .replace("## Refresh token", "## TMP")
        .replace("## Kết luận", "## Refresh token")
        .replace("## TMP", "## Kết luận");
    assertThat(checkDraft(swapped)).isNotEmpty();
  }

  @Test
  void codeFenceNeedsALanguage() {
    assertThat(checkDraft(draft("\n```\nplain\n```\n"))).isNotEmpty();
    assertThat(checkDraft(draft("\n```c#\nvar x = 1;\n```\n"))).isEmpty();
    assertThat(checkDraft(draft("\n```" + "a".repeat(33) + "\nx\n```\n"))).isNotEmpty();
  }

  @Test
  void contentOverOneMebibyteIsAnError() {
    String base = draft("");
    int bytes = base.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
    String atLimit = base + "x".repeat(ArticleContentService.MAX_CONTENT_BYTES - bytes);
    assertThat(checkDraft(atLimit)).isEmpty();
    assertThat(checkDraft(atLimit + "x")).isNotEmpty();
  }
}
