package com.techverse.server.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.techverse.server.dto.request.LessonTutorRequest;
import com.techverse.server.dto.response.AiStreamEvent;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.service.PublishedCourseService;
import com.techverse.server.service.PublishedCourseService.TutorLesson;
import com.techverse.server.service.impl.AiGenerationRegistry;
import com.techverse.server.service.impl.AiPromptFactory;
import com.techverse.server.service.impl.AiProviderExceptionMapper;
import com.techverse.server.service.impl.AiRateLimitService;
import com.techverse.server.service.impl.AiRateLimitService.Kind;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.LessonTutorService;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;
import tools.jackson.databind.json.JsonMapper;

class LessonTutorServiceTest {
  static final JsonMapper JSON = JsonMapper.builder().build();

  final UUID actor = UUID.randomUUID();
  final UUID courseId = UUID.randomUUID();
  final UUID lessonId = UUID.randomUUID();
  final ChatModel model = mock(ChatModel.class);
  final PublishedCourseService courses = mock(PublishedCourseService.class);
  final AiRateLimitService limits = mock(AiRateLimitService.class);
  final AiRateLimitServiceTest.MutableClock clock =
      new AiRateLimitServiceTest.MutableClock(Instant.parse("2026-11-17T03:00:00Z"));
  final AiGenerationRegistry registry = new AiGenerationRegistry(clock);
  final AiRateLimitService.Reservation reservation =
      new AiRateLimitService.Reservation("op-1", "ai:quota:tutor:x:20261117", 20, 19);
  final LessonTutorRequest request = new LessonTutorRequest("JWT là gì?", List.of());
  final List<Prompt> prompts = new ArrayList<>();
  Flux<ChatResponse> provider;
  LessonTutorService service;

  /** Records events; {@code failOn} simulates the client going away when that event is written. */
  static class TestEmitter extends SseEmitter {
    final List<AiStreamEvent> events = new ArrayList<>();
    Predicate<AiStreamEvent> failOn = e -> false;
    boolean completed;
    Runnable completion;

    @Override
    public void send(SseEventBuilder builder) throws IOException {
      if (completed) throw new IllegalStateException("send after complete");
      for (var d : builder.build()) {
        if (d.getData() instanceof AiStreamEvent e) {
          if (failOn.test(e)) throw new IOException("client gone");
          events.add(e);
        }
      }
    }

    @Override
    public synchronized void complete() {
      completed = true;
    }

    @Override
    public synchronized void onCompletion(Runnable callback) {
      completion = callback;
    }

    List<String> names() {
      return events.stream().map(AiStreamEvent::name).toList();
    }

    <T extends AiStreamEvent> T last(Class<T> type) {
      return type.cast(events.getLast());
    }
  }

  static ChatResponse chunk(String text, String finish) {
    var metadata = finish == null ? ChatGenerationMetadata.NULL : ChatGenerationMetadata.builder().finishReason(finish).build();
    return new ChatResponse(List.of(new Generation(new AssistantMessage(text), metadata)));
  }

  static AiAssistProperties props(Duration tutorTimeout) {
    return new AiAssistProperties(
        Duration.ofSeconds(60),
        Map.of("SHORT", Duration.ofSeconds(90), "MEDIUM", Duration.ofSeconds(120), "LONG", Duration.ofSeconds(180)),
        Map.of("OUTLINE", 2048, "SHORT", 4096, "MEDIUM", 8192, "LONG", 16384, "TUTOR", 2048, "EXERCISE", 4096,
            "INTERVIEW_DRAFT", 8192, "INTERVIEW_FEEDBACK", 2048),
        10,
        5,
        3,
        Duration.ofHours(24),
        20,
        tutorTimeout,
        10,
        Duration.ofSeconds(60),
        10,
        20,
        Duration.ofSeconds(60));
  }

  @BeforeEach
  void setup() {
    service = service(Duration.ofSeconds(60), true);
    when(courses.tutorLesson(actor, courseId, lessonId))
        .thenReturn(new TutorLesson("Khóa Spring", "Bài JWT", "Tóm tắt", "# Nội dung"));
    when(limits.reserve(actor, Kind.TUTOR)).thenReturn(reservation);
    when(limits.refund(reservation)).thenReturn(new Quota(20, 20));
    when(model.getDefaultOptions()).thenReturn(OpenAiChatOptions.builder().model("m").build());
    when(model.stream(any(Prompt.class))).thenAnswer(i -> {
      prompts.add(i.getArgument(0));
      return provider;
    });
    provider = Flux.just(chunk("Xin ", null), chunk("chào", "STOP"));
  }

  LessonTutorService service(Duration timeout, boolean withModel) {
    var factory = new StaticListableBeanFactory();
    if (withModel) factory.addBean("chatModel", model);
    return new LessonTutorService(
        factory.getBeanProvider(ChatModel.class),
        courses,
        limits,
        new AiPromptFactory(JSON),
        new AiProviderExceptionMapper(),
        registry,
        props(timeout),
        clock,
        Runnable::run);
  }

  TestEmitter run() {
    var g = service.start(actor, courseId, lessonId, request);
    var emitter = new TestEmitter();
    service.stream(g, emitter);
    return emitter;
  }

  // ------------------------------------------------------------------ stream outcomes

  @Test
  void successStreamsAndKeepsTheUse() {
    var e = run();

    assertThat(e.names()).containsExactly("metadata", "delta", "delta", "completed");
    assertThat(((AiStreamEvent.Metadata) e.events.getFirst()).contextTruncated()).isFalse();
    assertThat(e.last(AiStreamEvent.Completed.class).quotaRemaining()).isEqualTo(19);
    verify(limits, never()).refund(any());
    assertThat(e.completed).isTrue();
    // The slot is free again for the next question.
    service.start(actor, courseId, lessonId, request);
  }

  @Test
  void longLessonIsFlaggedInMetadata() {
    when(courses.tutorLesson(actor, courseId, lessonId))
        .thenReturn(new TutorLesson("K", "B", null, "a".repeat(AiPromptFactory.TUTOR_MAX_CONTEXT_CHARS + 1)));

    assertThat(((AiStreamEvent.Metadata) run().events.getFirst()).contextTruncated()).isTrue();
  }

  @Test
  void providerFailureRefundsOnce() {
    provider = Flux.error(new RuntimeException("boom"));

    var e = run();

    assertThat(e.names()).containsExactly("metadata", "error");
    assertThat(e.last(AiStreamEvent.Error.class).code()).isEqualTo("AI_PROVIDER_UNAVAILABLE");
    assertThat(e.last(AiStreamEvent.Error.class).quotaRemaining()).isEqualTo(20);
    verify(limits, times(1)).refund(reservation);
  }

  @Test
  void truncatedAnswerRefundsButKeepsStreamedText() {
    provider = Flux.just(chunk("Nửa câu", null), chunk(" đang", "length"));

    var e = run();

    assertThat(e.names()).containsExactly("metadata", "delta", "delta", "error");
    assertThat(e.last(AiStreamEvent.Error.class).code()).isEqualTo("AI_OUTPUT_TRUNCATED");
    verify(limits, times(1)).refund(reservation);
  }

  @Test
  void emptyAnswerIsAProviderFailure() {
    provider = Flux.just(chunk("", "STOP"));

    var e = run();

    assertThat(e.last(AiStreamEvent.Error.class).code()).isEqualTo("AI_PROVIDER_UNAVAILABLE");
    verify(limits, times(1)).refund(reservation);
  }

  @Test
  void deadlineEmitsTimeoutAndRefunds() throws Exception {
    var timed = service(Duration.ofMillis(100), true);
    provider = Flux.never();
    var g = timed.start(actor, courseId, lessonId, request);
    var done = new CountDownLatch(1);
    var e =
        new TestEmitter() {
          @Override
          public synchronized void complete() {
            super.complete();
            done.countDown();
          }
        };

    timed.stream(g, e);

    assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
    assertThat(e.last(AiStreamEvent.Error.class).code()).isEqualTo("AI_TIMEOUT");
    verify(limits, times(1)).refund(reservation);
  }

  @Test
  void refundFailureReportsUnknownQuota() {
    provider = Flux.error(new RuntimeException("boom"));
    when(limits.refund(reservation)).thenReturn(null);

    assertThat(run().last(AiStreamEvent.Error.class).quotaRemaining()).isNull();
  }

  @Test
  void disconnectBeforeFirstDeltaRefundsOnce() {
    var g = service.start(actor, courseId, lessonId, request);
    var e = new TestEmitter();
    e.failOn = ev -> ev instanceof AiStreamEvent.Delta;

    service.stream(g, e);
    e.completion.run(); // servlet container reports the closed connection too

    verify(limits, times(1)).refund(reservation);
    service.start(actor, courseId, lessonId, request); // slot released
  }

  @Test
  void disconnectAfterFirstDeltaKeepsTheUse() {
    var g = service.start(actor, courseId, lessonId, request);
    var e = new TestEmitter();
    var deltas = new int[1];
    e.failOn = ev -> ev instanceof AiStreamEvent.Delta && ++deltas[0] == 2;

    service.stream(g, e);

    assertThat(e.names()).containsExactly("metadata", "delta");
    verify(limits, never()).refund(any());
  }

  // ------------------------------------------------------------------ preflight

  @Test
  void lessonWithoutTextNeverReachesTheModelOrTheQuota() {
    for (String content : new String[] {null, "   "}) {
      when(courses.tutorLesson(actor, courseId, lessonId)).thenReturn(new TutorLesson("K", "B", null, content));
      assertThatThrownBy(() -> service.start(actor, courseId, lessonId, request))
          .extracting(t -> ((CustomException) t).getErrorCode())
          .isEqualTo(ErrorCode.AI_TUTOR_LESSON_NO_CONTENT);
    }
    verify(limits, never()).reserve(any(), any());
  }

  @Test
  void accessErrorFromCourseRulesPropagates() {
    when(courses.tutorLesson(actor, courseId, lessonId)).thenThrow(new CustomException(ErrorCode.ACCESS_DENIED));

    assertThatThrownBy(() -> service.start(actor, courseId, lessonId, request))
        .extracting(t -> ((CustomException) t).getErrorCode())
        .isEqualTo(ErrorCode.ACCESS_DENIED);
    verify(limits, never()).reserve(any(), any());
  }

  @Test
  void missingModelDoesNotSpendTheQuota() {
    assertThatThrownBy(() -> service(Duration.ofSeconds(60), false).start(actor, courseId, lessonId, request))
        .extracting(t -> ((CustomException) t).getErrorCode())
        .isEqualTo(ErrorCode.AI_CONFIGURATION_INVALID);
    verify(limits, never()).reserve(any(), any());
  }

  @Test
  void quotaBurstAndStorageErrorsStopBeforeTheModelAndFreeTheSlot() {
    for (ErrorCode code : List.of(ErrorCode.AI_QUOTA_EXCEEDED, ErrorCode.AI_RATE_LIMITED, ErrorCode.AI_STORAGE_UNAVAILABLE)) {
      org.mockito.Mockito.doThrow(new CustomException(code)).when(limits).reserve(actor, Kind.TUTOR);
      assertThatThrownBy(() -> service.start(actor, courseId, lessonId, request))
          .extracting(t -> ((CustomException) t).getErrorCode())
          .isEqualTo(code);
    }
    verify(model, never()).stream(any(Prompt.class));
    org.mockito.Mockito.doReturn(reservation).when(limits).reserve(actor, Kind.TUTOR);
    service.start(actor, courseId, lessonId, request); // earlier failures released the slot
  }

  @Test
  void secondTutorStreamIsBlockedWithoutSpendingTheQuota() {
    service.start(actor, courseId, lessonId, request);

    assertThatThrownBy(() -> service.start(actor, courseId, lessonId, request))
        .extracting(t -> ((CustomException) t).getErrorCode())
        .isEqualTo(ErrorCode.AI_GENERATION_IN_PROGRESS);
    verify(limits, times(1)).reserve(actor, Kind.TUTOR);
  }

  @Test
  void runningDraftDoesNotBlockTheTutor() {
    registry.start(actor, Kind.DRAFT, Duration.ofSeconds(90));

    service.start(actor, courseId, lessonId, request);
    // and the other way round
    assertThatThrownBy(() -> registry.start(actor, Kind.TUTOR, Duration.ofSeconds(60)))
        .extracting(t -> ((CustomException) t).getErrorCode())
        .isEqualTo(ErrorCode.AI_GENERATION_IN_PROGRESS);
  }

  @Test
  void quotaReadsTheTutorAllowance() {
    when(limits.peek(actor, Kind.TUTOR)).thenReturn(new Quota(20, 7));

    assertThat(service.quota(actor)).isEqualTo(new Quota(20, 7));
  }
}
