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
}
