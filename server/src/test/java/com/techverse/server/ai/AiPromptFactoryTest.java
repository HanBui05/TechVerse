package com.techverse.server.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.techverse.server.dto.request.LessonTutorRequest;
import com.techverse.server.service.impl.AiPromptFactory;
import com.techverse.server.service.impl.AiPromptFactory.TutorInput;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.MessageType;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class AiPromptFactoryTest {
  static final JsonMapper JSON = JsonMapper.builder().build();
  final AiPromptFactory factory = new AiPromptFactory(JSON);

  static LessonTutorRequest request(String question, List<LessonTutorRequest.Turn> history) {
    return new LessonTutorRequest(question, history);
  }

  JsonNode data(AiPromptFactory.TutorPrompt p) {
    var messages = p.prompt().getInstructions();
    assertThat(messages).hasSize(2);
    assertThat(messages.get(0).getMessageType()).isEqualTo(MessageType.SYSTEM);
    assertThat(messages.get(0).getText()).isEqualTo(AiPromptFactory.TUTOR_SYSTEM);
    assertThat(messages.get(1).getMessageType()).isEqualTo(MessageType.USER);
    return JSON.readTree(messages.get(1).getText());
  }

  @Test
  void tutorPromptCarriesCourseLessonAndHistoryAsData() {
    var history =
        List.of(
            new LessonTutorRequest.Turn("USER", "câu một"),
            new LessonTutorRequest.Turn("ASSISTANT", "trả lời một"));
    var p =
        factory.tutor(
            new TutorInput(request("JWT là gì?", history), "Khóa Spring", "Bài JWT", "Tóm tắt", "# Nội dung bài"),
            null);

    var d = data(p);
    assertThat(d.path("courseTitle").asText()).isEqualTo("Khóa Spring");
    assertThat(d.path("lessonTitle").asText()).isEqualTo("Bài JWT");
    assertThat(d.path("lessonSummary").asText()).isEqualTo("Tóm tắt");
    assertThat(d.path("lessonContent").asText()).isEqualTo("# Nội dung bài");
    assertThat(d.path("question").asText()).isEqualTo("JWT là gì?");
    assertThat(d.path("history").get(0).path("role").asText()).isEqualTo("USER");
    assertThat(d.path("history").get(1).path("content").asText()).isEqualTo("trả lời một");
    assertThat(p.contextTruncated()).isFalse();
  }

  @Test
  void contentIsCutAtLimitAndFlagged() {
    String content = "a".repeat(AiPromptFactory.TUTOR_MAX_CONTEXT_CHARS + 1);
    var p = factory.tutor(new TutorInput(request("q", List.of()), "K", "B", null, content), null);

    assertThat(data(p).path("lessonContent").asText()).hasSize(AiPromptFactory.TUTOR_MAX_CONTEXT_CHARS);
    assertThat(p.contextTruncated()).isTrue();
  }

  @Test
  void contentAtExactLimitIsNotFlagged() {
    String content = "a".repeat(AiPromptFactory.TUTOR_MAX_CONTEXT_CHARS);
    var p = factory.tutor(new TutorInput(request("q", List.of()), "K", "B", null, content), null);

    assertThat(p.contextTruncated()).isFalse();
  }
}
