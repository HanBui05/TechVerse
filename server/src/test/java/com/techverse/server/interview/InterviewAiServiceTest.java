package com.techverse.server.interview;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.InterviewQuestionResponse;
import com.techverse.server.enums.InterviewLevel;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.service.AuthorAiService.QuotaAwareException;
import com.techverse.server.service.impl.AiGenerationRegistry;
import com.techverse.server.service.impl.AiPromptFactory;
import com.techverse.server.service.impl.AiProviderExceptionMapper;
import com.techverse.server.service.impl.AiRateLimitService;
import com.techverse.server.service.impl.AiRateLimitService.Kind;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.ArticleContentService;
import com.techverse.server.service.impl.AuthorInterviewService;
import com.techverse.server.service.impl.AuthorInterviewService.AiContext;
import com.techverse.server.service.impl.AuthorInterviewService.AiDraft;
import com.techverse.server.service.impl.InterviewAiService;
import com.techverse.server.service.impl.InterviewAiService.Verdict;
import com.techverse.server.service.impl.PublishedInterviewService;
import com.techverse.server.service.impl.PublishedInterviewService.FeedbackContext;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class InterviewAiServiceTest {
    static final String Q1 = "{\"question\":\"JVM là gì và vì sao cần nó?\",\"sampleAnswer\":\"Máy ảo chạy bytecode, giúp Java chạy đa nền tảng.\",\"hint\":\"Nghĩ về bytecode\"}";
    static final String Q2 = "{\"question\":\"Garbage collector làm gì?\",\"sampleAnswer\":\"Thu hồi bộ nhớ của đối tượng không còn tham chiếu.\",\"hint\":\"\"}";
    static final String FEEDBACK_OK = """
            {"verdict":"PARTIAL","strengths":["Nêu đúng bytecode"],"missing":["Chưa nói đa nền tảng"],"advice":"Bổ sung ví dụ."}""";

    static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-20T03:00:00Z");

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    final UUID actor = UUID.randomUUID();
    final UUID topicId = UUID.randomUUID();
    final UUID questionId = UUID.randomUUID();
    final ChatModel model = mock(ChatModel.class);
    final AiRateLimitService limits = mock(AiRateLimitService.class);
    final AuthorInterviewService authors = spy(new AuthorInterviewService(null, new ArticleContentService(), null, null, null, null));
    final PublishedInterviewService published = mock(PublishedInterviewService.class);
    final MutableClock clock = new MutableClock();
    final AiGenerationRegistry registry = new AiGenerationRegistry(clock);
    final List<Prompt> prompts = new ArrayList<>();
    final Deque<Object> replies = new ArrayDeque<>();
    final Deque<Long> callSeconds = new ArrayDeque<>();
    final AiRateLimitService.Reservation draftUse = new AiRateLimitService.Reservation("op-d", "ai:quota:interview_draft:x:1", 10, 9);
    final AiRateLimitService.Reservation feedbackUse = new AiRateLimitService.Reservation("op-f", "ai:quota:interview_feedback:x:1", 20, 19);
    final InterviewQuestionRequest.AiDrafts drafts =
            new InterviewQuestionRequest.AiDrafts(topicId.toString(), "MEDIUM", "tập trung JVM", "JVM chạy bytecode.", BigDecimal.valueOf(2));
    final InterviewQuestionRequest.Feedback answer = new InterviewQuestionRequest.Feedback("  JVM chạy bytecode  ");

    InterviewAiService service(ChatModel chatModel) {
        var factory = new StaticListableBeanFactory();
        if (chatModel != null) factory.addBean("chatModel", chatModel);
        return new InterviewAiService(factory.getBeanProvider(ChatModel.class), authors, published, limits, registry,
                new AiPromptFactory(JsonMapper.builder().build()), new AiProviderExceptionMapper(), props(), clock);
    }

    public static AiAssistProperties props() {
        return new AiAssistProperties(Duration.ofSeconds(60),
                Map.of("SHORT", Duration.ofSeconds(90), "MEDIUM", Duration.ofSeconds(120), "LONG", Duration.ofSeconds(180)),
                Map.of("OUTLINE", 2048, "SHORT", 4096, "MEDIUM", 8192, "LONG", 16384, "TUTOR", 2048, "EXERCISE", 4096,
                        "INTERVIEW_DRAFT", 8192, "INTERVIEW_FEEDBACK", 2048),
                10, 5, 3, Duration.ofHours(24), 20, Duration.ofSeconds(60), 10, Duration.ofSeconds(60), 10, 20, Duration.ofSeconds(60));
    }

    void reply(String json) {
        replies.add(new String[] {json, "STOP"});
    }

    String items(String... items) {
        return "{\"questions\":[" + String.join(",", items) + "]}";
    }

    @SuppressWarnings("unchecked")
    List<AiDraft> saved() {
        ArgumentCaptor<List<AiDraft>> captor = ArgumentCaptor.forClass(List.class);
        verify(authors).saveAiDrafts(eq(actor), eq(topicId), eq(InterviewLevel.MEDIUM), captor.capture());
        return captor.getValue();
    }

    @BeforeEach
    void setup() {
        when(limits.reserve(actor, Kind.INTERVIEW_DRAFT)).thenReturn(draftUse);
        when(limits.reserve(actor, Kind.INTERVIEW_FEEDBACK)).thenReturn(feedbackUse);
        when(limits.refund(draftUse)).thenReturn(new Quota(10, 10));
        when(limits.refund(feedbackUse)).thenReturn(new Quota(20, 20));
        doReturn(new AiContext("Backend", List.of("Câu cũ về Spring"))).when(authors).aiContext(actor, topicId);
        doReturn(List.<InterviewQuestionResponse>of()).when(authors).saveAiDrafts(eq(actor), eq(topicId), eq(InterviewLevel.MEDIUM), anyList());
        when(published.feedbackContext(actor, questionId))
                .thenReturn(new FeedbackContext("Backend", InterviewLevel.MEDIUM, "JVM là gì?", "Máy ảo chạy bytecode, đa nền tảng."));
        when(model.getDefaultOptions()).thenReturn(OpenAiChatOptions.builder().model("m").build());
        when(model.call(any(Prompt.class))).thenAnswer(i -> {
            prompts.add(i.getArgument(0));
            if (!callSeconds.isEmpty()) clock.now = clock.now.plusSeconds(callSeconds.removeFirst());
            Object next = replies.removeFirst();
            if (next instanceof RuntimeException e) throw e;
            String[] r = (String[]) next;
            return new ChatResponse(List.of(new Generation(new AssistantMessage(r[0]),
                    ChatGenerationMetadata.builder().finishReason(r[1]).build())));
        });
    }

    ErrorCode draftFailure(InterviewAiService s) {
        var e = assertThatThrownBy(() -> s.draft(actor, drafts)).isInstanceOf(CustomException.class);
        return ((CustomException) e.actual()).getErrorCode();
    }

    ErrorCode feedbackFailure(InterviewAiService s) {
        var e = assertThatThrownBy(() -> s.feedback(actor, questionId, answer)).isInstanceOf(CustomException.class);
        return ((CustomException) e.actual()).getErrorCode();
    }

    // ------------------------------------------------------------------ drafts

    @Test
    void draftsAreSavedWithTheContextSentAsData() {
        reply(items(Q1, Q2));
        var r = service(model).draft(actor, drafts);
        assertThat(r.body().requested()).isEqualTo(2);
        assertThat(r.quota()).isEqualTo(new Quota(10, 9));
        var saved = saved();
        assertThat(saved).extracting(AiDraft::question).containsExactly("JVM là gì và vì sao cần nó?", "Garbage collector làm gì?");
        assertThat(saved.get(1).hint()).isNull();
        verify(limits, never()).refund(any());
        var user = prompts.get(0).getInstructions().get(1).getText();
        assertThat(user).contains("Backend", "MEDIUM", "tập trung JVM", "JVM chạy bytecode.", "Câu cũ về Spring", "sampleAnswer");
        assertThat(prompts.get(0).getInstructions().get(0).getText()).doesNotContain("tập trung JVM");
        var options = (OpenAiChatOptions) prompts.get(0).getOptions();
        assertThat(options.getMaxCompletionTokens()).isEqualTo(8192);
        assertThat(options.getTemperature()).isEqualTo(0.5);
    }

    @Test
    void duplicateDraftsAreDroppedAgainstTheBatchAndTheAuthorsExistingQuestions() {
        String sameAsQ1 = "{\"question\":\"  jvm là gì   và vì sao cần nó?\",\"sampleAnswer\":\"Đáp án đủ dài để qua kiểm tra độ dài.\",\"hint\":\"\"}";
        String existing = "{\"question\":\"Câu cũ về  SPRING\",\"sampleAnswer\":\"Đáp án đủ dài để qua kiểm tra độ dài.\",\"hint\":\"\"}";
        reply(items(Q1, sameAsQ1, existing, Q2));
        service(model).draft(actor, new InterviewQuestionRequest.AiDrafts(topicId.toString(), "MEDIUM", null, null, BigDecimal.valueOf(4)));
        assertThat(saved()).extracting(AiDraft::question).containsExactly("JVM là gì và vì sao cần nó?", "Garbage collector làm gì?");
    }

    @Test
    void draftsFailingTheAuthorChecksAreDroppedAndExtrasCut() {
        String shortQ = "{\"question\":\"Ngắn\",\"sampleAnswer\":\"Đáp án đủ dài để qua kiểm tra độ dài.\",\"hint\":\"\"}";
        String image = "{\"question\":\"Ảnh ![x](https://e.com/a.png) là gì?\",\"sampleAnswer\":\"Đáp án đủ dài để qua kiểm tra độ dài.\",\"hint\":\"\"}";
        String html = "{\"question\":\"HTML <script>alert(1)</script> là gì?\",\"sampleAnswer\":\"Đáp án đủ dài để qua kiểm tra độ dài.\",\"hint\":\"\"}";
        String longHint = "{\"question\":\"Câu hỏi đủ dài nhé?\",\"sampleAnswer\":\"Đáp án đủ dài để qua kiểm tra độ dài.\",\"hint\":\"" + "h".repeat(501) + "\"}";
        reply(items(shortQ, image, html, longHint, Q1, Q2));
        var request = new InterviewQuestionRequest.AiDrafts(topicId.toString(), "MEDIUM", null, null, BigDecimal.valueOf(5));
        service(model).draft(actor, request);
        // The first five are taken, then checked: only Q1 survives.
        assertThat(saved()).extracting(AiDraft::question).containsExactly("JVM là gì và vì sao cần nó?");
    }

    @Test
    void moreDraftsThanRequestedKeepOnlyTheFirstCount() {
        reply(items(Q1, Q2, Q1));
        service(model).draft(actor, new InterviewQuestionRequest.AiDrafts(topicId.toString(), "MEDIUM", null, null, BigDecimal.ONE));
        assertThat(saved()).hasSize(1);
    }

    @Test
    void noUsableDraftAfterTheRepairRefundsAndSavesNothing() {
        reply(items("{\"question\":\"x\",\"sampleAnswer\":\"y\",\"hint\":\"\"}"));
        reply("{\"questions\":[]}");
        var s = service(model);
        assertThatThrownBy(() -> s.draft(actor, drafts)).isInstanceOf(QuotaAwareException.class)
                .extracting(e -> ((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.AI_OUTPUT_INVALID);
        assertThat(prompts).hasSize(2);
        assertThat(prompts.get(1).getInstructions().get(1).getText()).contains("repair");
        verify(limits).refund(draftUse);
        verify(authors, never()).saveAiDrafts(any(), any(), any(), anyList());
    }

    @Test
    void losingEligibilityOrTheTopicWhileWaitingRefundsAndSavesNothing() {
        doThrow(new CustomException(ErrorCode.ACCESS_DENIED)).when(authors).saveAiDrafts(eq(actor), eq(topicId), any(), anyList());
        reply(items(Q1));
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.ACCESS_DENIED);
        doThrow(new CustomException(ErrorCode.INTERVIEW_TOPIC_INACTIVE)).when(authors).saveAiDrafts(eq(actor), eq(topicId), any(), anyList());
        reply(items(Q1));
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.INTERVIEW_TOPIC_INACTIVE);
        verify(limits, times(2)).refund(draftUse);
    }

    @Test
    void draftPreflightFailuresNeitherReserveNorCallTheModel() {
        doThrow(new CustomException(ErrorCode.INTERVIEW_TOPIC_INACTIVE)).when(authors).aiContext(actor, topicId);
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.INTERVIEW_TOPIC_INACTIVE);
        doReturn(new AiContext("Backend", List.of())).when(authors).aiContext(actor, topicId);
        assertThat(draftFailure(service(null))).isEqualTo(ErrorCode.AI_CONFIGURATION_INVALID);
        verify(limits, never()).reserve(any(), any());
        verify(model, never()).call(any(Prompt.class));
    }

    @Test
    void providerFailuresTruncationAndTimeoutRefundTheUse() {
        replies.add(new RuntimeException("boom"));
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.AI_PROVIDER_UNAVAILABLE);
        replies.add(new String[] {"{\"questions\":[", "length"});
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.AI_OUTPUT_TRUNCATED);
        callSeconds.add(61L);
        reply("không phải json");
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.AI_TIMEOUT);
        replies.add(new CustomException(ErrorCode.AI_PROVIDER_RATE_LIMITED));
        assertThat(feedbackFailure(service(model))).isEqualTo(ErrorCode.AI_PROVIDER_RATE_LIMITED);
        verify(limits, times(3)).refund(draftUse);
        verify(limits).refund(feedbackUse);
    }

    @Test
    void aFailedRefundStillReturnsTheOriginalError() {
        when(limits.refund(draftUse)).thenReturn(null);
        replies.add(new RuntimeException("boom"));
        var s = service(model);
        assertThatThrownBy(() -> s.draft(actor, drafts)).isNotInstanceOf(QuotaAwareException.class)
                .extracting(e -> ((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.AI_PROVIDER_UNAVAILABLE);
    }

    @Test
    void aSecondRequestIsRejectedWithoutSpendingAUseAndTheSlotIsReleasedAfterwards() {
        UUID running = registry.start(actor, Kind.DRAFT, Duration.ofSeconds(60));
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.AI_GENERATION_IN_PROGRESS);
        assertThat(feedbackFailure(service(model))).isEqualTo(ErrorCode.AI_GENERATION_IN_PROGRESS);
        verify(limits, never()).reserve(any(), any());
        registry.finish(running);

        replies.add(new RuntimeException("boom"));
        feedbackFailure(service(model));
        reply(FEEDBACK_OK);
        assertThat(service(model).feedback(actor, questionId, answer).body().verdict()).isEqualTo(Verdict.PARTIAL);
        // Quota exhausted: no model call and the slot is freed too.
        when(limits.reserve(actor, Kind.INTERVIEW_DRAFT)).thenThrow(new CustomException(ErrorCode.AI_QUOTA_EXCEEDED));
        assertThat(draftFailure(service(model))).isEqualTo(ErrorCode.AI_QUOTA_EXCEEDED);
        assertThat(registry.start(actor, Kind.DRAFT, Duration.ofSeconds(60))).isNotNull();
    }

    // ------------------------------------------------------------------ feedback

    @Test
    void feedbackSpendsOneUseAndNeverEchoesTheSampleAnswer() {
        reply(FEEDBACK_OK);
        var r = service(model).feedback(actor, questionId, answer);
        assertThat(r.quota()).isEqualTo(new Quota(20, 19));
        assertThat(r.body().verdict()).isEqualTo(Verdict.PARTIAL);
        assertThat(r.body().strengths()).containsExactly("Nêu đúng bytecode");
        assertThat(r.body().missing()).containsExactly("Chưa nói đa nền tảng");
        assertThat(r.body().advice()).isEqualTo("Bổ sung ví dụ.");
        verify(limits).reserve(actor, Kind.INTERVIEW_FEEDBACK);
        verify(limits, never()).refund(any());
        var user = prompts.get(0).getInstructions().get(1).getText();
        assertThat(user).contains("JVM là gì?", "Máy ảo chạy bytecode, đa nền tảng.", "JVM chạy bytecode", "Backend", "verdict");
        assertThat(prompts.get(0).getInstructions().get(0).getText()).doesNotContain("JVM chạy bytecode");
        assertThat(((OpenAiChatOptions) prompts.get(0).getOptions()).getMaxCompletionTokens()).isEqualTo(2048);
        assertThat(((OpenAiChatOptions) prompts.get(0).getOptions()).getTemperature()).isEqualTo(0.2);
    }

    @Test
    void extraPointsAreCutAndBlankOnesDropped() {
        reply("""
                {"verdict":"GOOD","strengths":["a"," ","b","c","d"],"missing":["1","2","","3","4","5","6"],"advice":"  Tốt.  "}""");
        var f = service(model).feedback(actor, questionId, answer).body();
        assertThat(f.strengths()).containsExactly("a", "b", "c");
        assertThat(f.missing()).containsExactly("1", "2", "3", "4", "5");
        assertThat(f.advice()).isEqualTo("Tốt.");
    }

    @Test
    void malformedFeedbackIsRepairedOnceThenRejectedWithARefund() {
        String[] bad = {
            "{\"verdict\":\"EXCELLENT\",\"strengths\":[],\"missing\":[],\"advice\":\"x\"}",
            "{\"verdict\":\"GOOD\",\"strengths\":[],\"missing\":[],\"advice\":\"   \"}",
            "{\"verdict\":\"GOOD\",\"strengths\":[],\"missing\":[],\"advice\":\"" + "a".repeat(801) + "\"}",
            "{\"verdict\":\"GOOD\",\"strengths\":[\"" + "s".repeat(301) + "\"],\"missing\":[],\"advice\":\"x\"}",
            "{\"verdict\":\"GOOD\",\"strengths\":[],\"advice\":\"x\"}"
        };
        for (String b : bad) {
            reply(b);
            reply(b);
            assertThat(feedbackFailure(service(model))).as(b).isEqualTo(ErrorCode.AI_OUTPUT_INVALID);
        }
        verify(limits, times(bad.length)).refund(feedbackUse);

        prompts.clear();
        reply(bad[0]);
        reply(FEEDBACK_OK);
        assertThat(service(model).feedback(actor, questionId, answer).body().verdict()).isEqualTo(Verdict.PARTIAL);
        assertThat(prompts.get(1).getInstructions().get(1).getText()).contains("repair", "EXCELLENT");
    }

    @Test
    void anUnavailableQuestionNeitherReservesNorCallsTheModel() {
        when(published.feedbackContext(actor, questionId)).thenThrow(new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        assertThat(feedbackFailure(service(model))).isEqualTo(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND);
        verify(limits, never()).reserve(any(), any());
        verify(model, never()).call(any(Prompt.class));
    }

    @Test
    void feedbackQuotaChecksTheAccountAndOnlyPeeks() {
        when(limits.peek(actor, Kind.INTERVIEW_FEEDBACK)).thenReturn(new Quota(20, 17));
        assertThat(service(model).feedbackQuota(actor)).isEqualTo(new Quota(20, 17));
        verify(published).reader(actor);
        verify(limits, never()).reserve(any(), any());
    }
}
