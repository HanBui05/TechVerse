package com.techverse.server.exercise;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.techverse.server.dto.request.ExerciseSetRequest.AiQuestions;
import com.techverse.server.enums.ExerciseDifficulty;
import com.techverse.server.enums.ExerciseType;
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
import com.techverse.server.service.impl.AuthorExerciseService;
import com.techverse.server.service.impl.AuthorExerciseService.AiContext;
import com.techverse.server.service.impl.ExerciseAiService;

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
import org.springframework.transaction.PlatformTransactionManager;

import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;

class ExerciseAiServiceTest {
    static final String QUIZ_OK = """
            {"questions":[{"content":"JWT gồm mấy phần?","codeSnippet":"","codeLanguage":"",
            "options":["1","2","3","4"],"correctIndex":2,"explanation":"Header, payload, signature."}]}""";
    static final String CARD_OK = "{\"questions\":[{\"front\":\"HTTP 404?\",\"back\":\"Not Found\"}]}";

    static final class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-17T03:00:00Z");

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    final UUID actor = UUID.randomUUID();
    final UUID setId = UUID.randomUUID();
    final ChatModel model = mock(ChatModel.class);
    final AiRateLimitService limits = mock(AiRateLimitService.class);
    final AuthorExerciseService exercises =
            spy(new AuthorExerciseService(null, new ArticleContentService(), null, null, null, null, null));
    final MutableClock clock = new MutableClock();
    final AiGenerationRegistry registry = new AiGenerationRegistry(clock);
    final List<Prompt> prompts = new ArrayList<>();
    final Deque<Object> replies = new ArrayDeque<>();
    // The second-pass check: explicit replies when queued, otherwise every question is confirmed.
    final List<Prompt> verifyPrompts = new ArrayList<>();
    final Deque<String> verifyReplies = new ArrayDeque<>();
    final Deque<Long> callSeconds = new ArrayDeque<>();
    final AiRateLimitService.Reservation reservation = new AiRateLimitService.Reservation("op-1", "ai:quota:exercise:x:1", 10, 9);
    final AiQuestions request = new AiQuestions(6, "tập trung vào JWT", "JWT là chuẩn token.", 2);

    ExerciseAiService service(ChatModel chatModel) {
        var factory = new StaticListableBeanFactory();
        if (chatModel != null) factory.addBean("chatModel", chatModel);
        return new ExerciseAiService(factory.getBeanProvider(ChatModel.class), exercises, limits, registry,
                new AiPromptFactory(JsonMapper.builder().build()), new AiProviderExceptionMapper(),
                props(), mock(PlatformTransactionManager.class), clock);
    }

    static AiAssistProperties props() {
        return com.techverse.server.interview.InterviewAiServiceTest.props();
    }

    AiContext ctx(ExerciseType type) {
        return new AiContext(type, "Java cơ bản", "Mô tả", "Backend", ExerciseDifficulty.EASY, List.of("Câu cũ về Spring"), 6);
    }

    void givenSet(ExerciseType type) {
        doReturn(ctx(type)).when(exercises).aiContext(eq(actor), eq(setId), anyInt(), eq(6));
        doReturn(7).when(exercises).markAiAssisted(eq(actor), eq(setId), anyInt(), eq(6));
    }

    void reply(String json) {
        replies.add(new String[] {json, "STOP"});
    }

    @BeforeEach
    void setup() {
        when(limits.reserve(actor, Kind.EXERCISE)).thenReturn(reservation);
        when(limits.refund(reservation)).thenReturn(new Quota(10, 10));
        when(model.getDefaultOptions()).thenReturn(OpenAiChatOptions.builder().model("m").build());
        when(model.call(any(Prompt.class))).thenAnswer(i -> {
            Prompt p = i.getArgument(0);
            if (AiPromptFactory.EXERCISE_VERIFY_SYSTEM.equals(p.getInstructions().get(0).getText())) {
                verifyPrompts.add(p);
                String text = verifyReplies.isEmpty() ? allConfirmed(p) : verifyReplies.removeFirst();
                return new ChatResponse(List.of(new Generation(new AssistantMessage(text),
                        ChatGenerationMetadata.builder().finishReason("STOP").build())));
            }
            prompts.add(p);
            if (!callSeconds.isEmpty()) clock.now = clock.now.plusSeconds(callSeconds.removeFirst());
            Object next = replies.removeFirst();
            if (next instanceof RuntimeException e) throw e;
            String[] r = (String[]) next;
            return new ChatResponse(List.of(new Generation(new AssistantMessage(r[0]),
                    ChatGenerationMetadata.builder().finishReason(r[1]).build())));
        });
    }

    static String allConfirmed(Prompt p) {
        int n = JsonMapper.builder().build().readTree(p.getInstructions().get(1).getText()).path("questions").size();
        var results = new ArrayList<String>();
        for (int i = 0; i < n; i++) results.add("{\"index\":" + i + ",\"ok\":true,\"reason\":\"\"}");
        return "{\"results\":[" + String.join(",", results) + "]}";
    }

    String twoQuiz() {
        String item = "{\"content\":\"%s\",\"codeSnippet\":\"\",\"codeLanguage\":\"\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"correctIndex\":1,\"explanation\":\"vì b\"}";
        return "{\"questions\":[" + item.formatted("Câu đúng về JWT?") + "," + item.formatted("Câu có hai đáp án đúng?") + "]}";
    }

    @Test
    void aSecondCheckDropsQuestionsItDoesNotConfirm() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        reply(twoQuiz());
        verifyReplies.add("{\"results\":[{\"index\":0,\"ok\":true,\"reason\":\"\"},{\"index\":1,\"ok\":false,\"reason\":\"Hai đáp án cùng đúng\"}]}");
        var r = service(model).suggest(actor, setId, request);
        assertThat(r.body().questions()).extracting("content").containsExactly("Câu đúng về JWT?");
        verify(exercises).markAiAssisted(actor, setId, 1, 6);
        var check = verifyPrompts.get(0);
        assertThat(((OpenAiChatOptions) check.getOptions()).getTemperature()).isEqualTo(0.0);
        // The checker sees the candidates (with the correct index) as data, plus the set's context.
        var data = check.getInstructions().get(1).getText();
        assertThat(data).contains("Câu có hai đáp án đúng?", "correctIndex", "Backend", "EASY", "JWT là chuẩn token.");
        assertThat(check.getInstructions().get(0).getText()).doesNotContain("Câu có hai đáp án đúng?");
        verify(limits, times(1)).reserve(actor, Kind.EXERCISE);
    }

    @Test
    void aQuestionTheCheckSkipsIsDroppedAndNothingConfirmedRefunds() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        reply(twoQuiz());
        verifyReplies.add("{\"results\":[{\"index\":1,\"ok\":true,\"reason\":\"\"}]}");
        assertThat(service(model).suggest(actor, setId, new AiQuestions(6, null, null, 2)).body().questions())
                .extracting("content").containsExactly("Câu có hai đáp án đúng?");

        reply(twoQuiz());
        verifyReplies.add("{\"results\":[{\"index\":0,\"ok\":false,\"reason\":\"sai\"},{\"index\":1,\"ok\":false,\"reason\":\"sai\"}]}");
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_OUTPUT_INVALID);
        reply(twoQuiz());
        verifyReplies.add("không phải json");
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_OUTPUT_INVALID);
        verify(limits, times(2)).refund(reservation);
        verify(exercises, times(1)).markAiAssisted(any(), any(), anyInt(), anyInt());
    }

    ErrorCode failure(ExerciseAiService service) {
        var e = assertThatThrownBy(() -> service.suggest(actor, setId, request)).isInstanceOf(CustomException.class);
        return ((CustomException) e.actual()).getErrorCode();
    }

    /** Groq rejects strict schemas where `format` sits on a non-string (Spring AI emits int32 for Integer): 400 AI_PROVIDER_REQUEST_REJECTED. */
    @Test
    void strictSchemaCarriesNoNumericFormat() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        reply(QUIZ_OK);
        service(model).suggest(actor, setId, request);
        var prompt = prompts.get(0);
        var schema = ((OpenAiChatOptions) prompt.getOptions()).getResponseFormat().getJsonSchema();
        assertThat(schema).contains("correctIndex").doesNotContain("\"format\"");
        assertThat(prompt.getInstructions().get(1).getText()).doesNotContain("int32");
    }

    @Test
    void quizSuggestionsFlagTheSetAndCarryTheContextAsData() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        reply(QUIZ_OK);
        var r = service(model).suggest(actor, setId, request);
        assertThat(r.body().questions()).hasSize(1);
        var q = r.body().questions().get(0);
        // Options are shuffled; the correct one keeps its text.
        assertThat(q.options()).containsExactlyInAnyOrder("1", "2", "3", "4");
        assertThat(q.options().get(q.correctIndex())).isEqualTo("3");
        assertThat(((OpenAiChatOptions) prompts.get(0).getOptions()).getTemperature()).isEqualTo(0.4);
        assertThat(r.body().requested()).isEqualTo(2);
        assertThat(r.body().version()).isEqualTo(7);
        assertThat(r.quota()).isEqualTo(new Quota(10, 9));
        verify(exercises).markAiAssisted(actor, setId, 1, 6);
        verify(limits, never()).refund(any());
        var user = prompts.get(0).getInstructions().get(1).getText();
        assertThat(user).contains("MULTIPLE_CHOICE", "Java cơ bản", "Backend", "Câu cũ về Spring", "tập trung vào JWT",
                "JWT là chuẩn token.", "correctIndex");
        assertThat(prompts.get(0).getInstructions().get(0).getText()).doesNotContain("JWT là chuẩn token.");
    }

    @Test
    void theCorrectOptionLandsInDifferentPlacesEvenWhenTheModelAlwaysPutsItFirst() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        var seen = new java.util.HashSet<Integer>();
        for (int run = 0; run < 10; run++) {
            var items = new ArrayList<String>();
            for (int i = 0; i < 4; i++)
                items.add("{\"content\":\"Câu " + run + "-" + i + "\",\"codeSnippet\":\"\",\"codeLanguage\":\"\","
                        + "\"options\":[\"đúng\",\"sai một\",\"sai hai\",\"sai ba\"],\"correctIndex\":0,\"explanation\":\"Vì đúng.\"}");
            reply("{\"questions\":[" + String.join(",", items) + "]}");
            for (var q : service(model).suggest(actor, setId, new AiQuestions(6, null, null, 4)).body().questions()) {
                assertThat(q.options().get(q.correctIndex())).isEqualTo("đúng");
                seen.add(q.correctIndex());
            }
        }
        assertThat(seen).hasSizeGreaterThan(1);
    }

    @Test
    void repeatsOfAnEarlierSuggestionOrOfAnExistingQuestionAreDropped() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        String item = "{\"content\":\"%s\",\"codeSnippet\":\"\",\"codeLanguage\":\"\",\"options\":[\"a\",\"b\",\"c\",\"d\"],\"correctIndex\":1,\"explanation\":\"vì b\"}";
        reply("{\"questions\":[" + String.join(",", item.formatted("JWT gồm mấy phần?"), item.formatted("  jwt GỒM mấy   phần?"),
                item.formatted("Câu cũ về  spring"), item.formatted("OAuth2 là gì?")) + "]}");
        var r = service(model).suggest(actor, setId, new AiQuestions(6, null, null, 4));
        assertThat(r.body().questions()).extracting("content").containsExactly("JWT gồm mấy phần?", "OAuth2 là gì?");

        givenSet(ExerciseType.FLASHCARD);
        reply("{\"questions\":[{\"front\":\"HTTP 404?\",\"back\":\"Not Found\"},{\"front\":\"http 404?\",\"back\":\"Không thấy\"}]}");
        assertThat(service(model).suggest(actor, setId, new AiQuestions(6, null, null, 2)).body().questions()).hasSize(1);
    }

    @Test
    void flashcardSuggestionsUseTheCardShape() {
        givenSet(ExerciseType.FLASHCARD);
        reply(CARD_OK);
        var q = service(model).suggest(actor, setId, request).body().questions().get(0);
        assertThat(q.front()).isEqualTo("HTTP 404?");
        assertThat(q.back()).isEqualTo("Not Found");
        assertThat(q.options()).isNull();
        assertThat(prompts.get(0).getInstructions().get(1).getText()).contains("FLASHCARD", "front", "back");
    }

    @Test
    void questionsFailingTheSaveChecksAreDropped() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        reply("""
                {"questions":[
                {"content":"Sai chỉ số","codeSnippet":"","codeLanguage":"","options":["a","b","c","d"],"correctIndex":5,"explanation":"x"},
                {"content":"Chỉ hai lựa chọn","codeSnippet":"","codeLanguage":"","options":["a","b"],"correctIndex":0,"explanation":"x"},
                {"content":"Năm lựa chọn","codeSnippet":"","codeLanguage":"","options":["a","b","c","d","e"],"correctIndex":0,"explanation":"x"},
                {"content":"Có ảnh ![x](https://e.com/a.png)","codeSnippet":"","codeLanguage":"","options":["a","b"],"correctIndex":0,"explanation":"x"},
                {"content":"Hợp lệ","codeSnippet":"","codeLanguage":"","options":["a","b","c","d"],"correctIndex":1,"explanation":"vì b"}]}""");
        var r = service(model).suggest(actor, setId, new AiQuestions(6, null, null, 3));
        assertThat(r.body().questions()).extracting("content").containsExactly("Hợp lệ");
        verify(exercises).markAiAssisted(actor, setId, 1, 6);
    }

    @Test
    void extraQuestionsBeyondCountAreCut() {
        givenSet(ExerciseType.FLASHCARD);
        reply("{\"questions\":[{\"front\":\"a\",\"back\":\"b\"},{\"front\":\"c\",\"back\":\"d\"},{\"front\":\"e\",\"back\":\"f\"}]}");
        var r = service(model).suggest(actor, setId, new AiQuestions(6, null, null, 2));
        assertThat(r.body().questions()).hasSize(2);
    }

    @Test
    void noUsableQuestionRefundsAndLeavesTheFlagAlone() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        reply("{\"questions\":[{\"content\":\"x\",\"codeSnippet\":\"\",\"codeLanguage\":\"\",\"options\":[\"a\"],\"correctIndex\":0,\"explanation\":\"y\"}]}");
        var s = service(model);
        assertThatThrownBy(() -> s.suggest(actor, setId, request)).isInstanceOf(QuotaAwareException.class)
                .extracting(e -> ((CustomException) e).getErrorCode()).isEqualTo(ErrorCode.AI_OUTPUT_INVALID);
        verify(limits).refund(reservation);
        verify(exercises, never()).markAiAssisted(any(), any(), anyInt(), anyInt());
    }

    @Test
    void oneRepairIsAllowedThenTheOutputIsRejected() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        reply("không phải json");
        reply(QUIZ_OK);
        assertThat(service(model).suggest(actor, setId, request).body().questions()).hasSize(1);
        assertThat(prompts).hasSize(2);
        assertThat(prompts.get(1).getInstructions().get(1).getText()).contains("repair", "không phải json");
        verify(limits, times(1)).reserve(actor, Kind.EXERCISE);

        prompts.clear();
        reply("{\"questions\":[]}");
        reply("{\"oops\":1}");
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_OUTPUT_INVALID);
        assertThat(prompts).hasSize(2);
    }

    @Test
    void providerFailuresTruncationAndTimeoutRefundTheUse() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        replies.add(new RuntimeException("boom"));
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_PROVIDER_UNAVAILABLE);
        replies.add(new String[] {"{\"questions\":[", "length"});
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_OUTPUT_TRUNCATED);
        callSeconds.add(61L);
        reply("không phải json");
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_TIMEOUT);
        replies.add(new CustomException(ErrorCode.AI_PROVIDER_RATE_LIMITED));
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_PROVIDER_RATE_LIMITED);
        verify(limits, times(4)).refund(reservation);
        verify(exercises, never()).markAiAssisted(any(), any(), anyInt(), anyInt());
    }

    @Test
    void aSetChangedWhileTheModelWorksFailsAndRefunds() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        doThrow(new CustomException(ErrorCode.EXERCISE_VERSION_CONFLICT)).when(exercises).markAiAssisted(eq(actor), eq(setId), anyInt(), anyInt());
        reply(QUIZ_OK);
        assertThat(failure(service(model))).isEqualTo(ErrorCode.EXERCISE_VERSION_CONFLICT);
        verify(limits).refund(reservation);
    }

    @Test
    void preflightFailuresNeitherReserveNorCallTheModel() {
        doThrow(new CustomException(ErrorCode.EXERCISE_NOT_EDITABLE)).when(exercises).aiContext(any(), any(), anyInt(), anyInt());
        assertThat(failure(service(model))).isEqualTo(ErrorCode.EXERCISE_NOT_EDITABLE);
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        assertThat(failure(service(null))).isEqualTo(ErrorCode.AI_CONFIGURATION_INVALID);
        verify(limits, never()).reserve(any(), any());
        verify(model, never()).call(any(Prompt.class));
    }

    @Test
    void aSecondRequestIsRejectedWithoutSpendingAUseAndTheSlotIsReleasedAfterwards() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        UUID running = registry.start(actor, Kind.DRAFT, Duration.ofSeconds(60));
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_GENERATION_IN_PROGRESS);
        verify(limits, never()).reserve(any(), any());
        registry.finish(running);

        replies.add(new RuntimeException("boom"));
        failure(service(model));
        reply(QUIZ_OK);
        assertThat(service(model).suggest(actor, setId, request).body().questions()).hasSize(1);
    }

    @Test
    void quotaExhaustedStopsBeforeTheModelAndFreesTheSlot() {
        givenSet(ExerciseType.MULTIPLE_CHOICE);
        when(limits.reserve(actor, Kind.EXERCISE)).thenThrow(new CustomException(ErrorCode.AI_QUOTA_EXCEEDED));
        assertThat(failure(service(model))).isEqualTo(ErrorCode.AI_QUOTA_EXCEEDED);
        verify(model, never()).call(any(Prompt.class));
        verify(limits, never()).refund(any());
        assertThat(registry.start(actor, Kind.DRAFT, Duration.ofSeconds(60))).isNotNull();
    }
}
