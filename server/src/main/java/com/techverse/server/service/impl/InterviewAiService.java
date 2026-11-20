package com.techverse.server.service.impl;

import com.techverse.server.dto.request.InterviewQuestionRequest;
import com.techverse.server.dto.response.InterviewQuestionResponse;
import com.techverse.server.enums.InterviewLevel;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.service.AuthorAiService.QuotaAwareException;
import com.techverse.server.service.impl.AiPromptFactory.InterviewDraftInput;
import com.techverse.server.service.impl.AiPromptFactory.InterviewFeedbackInput;
import com.techverse.server.service.impl.AiRateLimitService.Kind;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.AuthorInterviewService.AiDraft;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.openai.OpenAiChatModel.ResponseFormat;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * Interview AI: drafts saved for the Author, and feedback on a learner's answer (nothing saved).
 * No transaction is held during the provider call; both flows share the DRAFT running slot.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewAiService {
    private static final JsonMapper STRICT =
            JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

    public enum Verdict { GOOD, PARTIAL, OFF_TRACK }

    record DraftOutput(List<AiDraft> questions) {}

    record FeedbackOutput(Verdict verdict, List<String> strengths, List<String> missing, String advice) {}

    public record Drafts(List<InterviewQuestionResponse> questions, int requested) {}

    public record Feedback(Verdict verdict, List<String> strengths, List<String> missing, String advice) {}

    public record Result<T>(T body, Quota quota) {}

    @FunctionalInterface
    private interface Ask {
        Prompt of(String schema, String invalidOutput, OpenAiChatOptions options);
    }

    private final ObjectProvider<ChatModel> chatModels;
    private final AuthorInterviewService authors;
    private final PublishedInterviewService published;
    private final AiRateLimitService limits;
    private final AiGenerationRegistry registry;
    private final AiPromptFactory prompts;
    private final AiProviderExceptionMapper providerErrors;
    private final AiAssistProperties properties;
    private final Clock clock;

    public Result<Drafts> draft(UUID actor, InterviewQuestionRequest.AiDrafts r) {
        UUID topicId = UUID.fromString(r.topicId());
        var level = InterviewLevel.valueOf(r.level());
        int count = r.count().intValueExact();
        var ctx = authors.aiContext(actor, topicId);
        var input = new InterviewDraftInput(ctx.topic(), level.name(), r.instruction(), r.sourceText(), ctx.existing(), count);
        return run(actor, Kind.INTERVIEW_DRAFT, (model, deadline) -> {
            List<AiDraft> usable = generate(model, DraftOutput.class, o -> usableDrafts(o, count),
                    properties.interviewDraftTokens(), deadline, (s, bad, opt) -> prompts.interviewDraft(input, s, bad, opt));
            return new Drafts(authors.saveAiDrafts(actor, topicId, level, usable), count);
        });
    }

    public Result<Feedback> feedback(UUID actor, UUID questionId, InterviewQuestionRequest.Feedback r) {
        // Access and state are checked once, before the call; a question hidden meanwhile still gets its feedback.
        var ctx = published.feedbackContext(actor, questionId);
        var input = new InterviewFeedbackInput(ctx.topic(), ctx.level().name(), ctx.question(), ctx.sampleAnswer(), r.answer());
        return run(actor, Kind.INTERVIEW_FEEDBACK, (model, deadline) -> generate(model, FeedbackOutput.class,
                InterviewAiService::cleanFeedback, properties.interviewFeedbackTokens(), deadline,
                (s, bad, opt) -> prompts.interviewFeedback(input, s, bad, opt)));
    }

    /** Read-only allowance; a locked account is refused. */
    public Quota feedbackQuota(UUID actor) {
        published.reader(actor);
        return limits.peek(actor, Kind.INTERVIEW_FEEDBACK);
    }

    /** Slot before quota (a busy slot spends nothing); any failure after the reservation refunds it once. */
    private <T> Result<T> run(UUID actor, Kind kind, BiFunction<ChatModel, Instant, T> work) {
        ChatModel model = chatModels.getIfAvailable();
        if (model == null) throw new CustomException(ErrorCode.AI_CONFIGURATION_INVALID);
        UUID slot = registry.start(actor, Kind.DRAFT, properties.interviewTimeout());
        try {
            var reservation = limits.reserve(actor, kind);
            Instant started = clock.instant();
            try {
                T body = work.apply(model, started.plus(properties.interviewTimeout()));
                log.info("AI {} actor={} outcome=OK ms={}", kind, actor, elapsedMs(started));
                return new Result<>(body, reservation.quota());
            } catch (RuntimeException e) {
                Quota refunded = limits.refund(reservation);
                ErrorCode code = providerErrors.map(e).getErrorCode();
                log.info("AI {} actor={} outcome={} ms={}", kind, actor, code.getCode(), elapsedMs(started));
                throw refunded == null ? new CustomException(code) : new QuotaAwareException(code, refunded);
            }
        } finally {
            registry.finish(slot);
        }
    }

    /** First {@code count} items, each through the Author's save checks; none usable counts as invalid output. */
    private List<AiDraft> usableDrafts(DraftOutput o, int count) {
        if (o.questions() == null) return null;
        var usable = o.questions().stream().limit(count).map(authors::aiUsable).filter(Objects::nonNull).toList();
        return usable.isEmpty() ? null : usable;
    }

    private static Feedback cleanFeedback(FeedbackOutput o) {
        if (o.verdict() == null || o.strengths() == null || o.missing() == null || o.advice() == null) return null;
        var strengths = points(o.strengths(), 3);
        var missing = points(o.missing(), 5);
        String advice = o.advice().strip();
        if (strengths == null || missing == null || advice.isEmpty() || advice.length() > 800) return null;
        return new Feedback(o.verdict(), strengths, missing, advice);
    }

    /** Blank points dropped, extras cut; a kept point over 300 characters makes the output invalid. */
    private static List<String> points(List<String> in, int max) {
        var out = in.stream().filter(Objects::nonNull).map(String::strip).filter(s -> !s.isEmpty()).limit(max).toList();
        return out.stream().anyMatch(s -> s.length() > 300) ? null : out;
    }

    /** The call and its one repair share a single deadline and a single reserved use. */
    private <O, R> R generate(ChatModel model, Class<O> out, Function<O, R> usable, int tokens, Instant deadline, Ask ask) {
        // Groq's strict mode rejects `format` on non-strings (see ExerciseAiService).
        String schema = new BeanOutputConverter<>(out).getJsonSchema().replaceAll(",?\\s*\"format\"\\s*:\\s*\"(?:int32|int64|float|double)\"", "");
        var format = ResponseFormat.builder().type(ResponseFormat.Type.JSON_SCHEMA).jsonSchema(schema).strict(true).build();
        String text = call(model, ask.of(schema, null, options(model, tokens, format, deadline)));
        R result = parse(text, out, usable);
        if (result == null) {
            text = call(model, ask.of(schema, text, options(model, tokens, format, deadline)));
            result = parse(text, out, usable);
        }
        if (result == null) throw new CustomException(ErrorCode.AI_OUTPUT_INVALID);
        return result;
    }

    private static <O, R> R parse(String text, Class<O> out, Function<O, R> usable) {
        try {
            O o = STRICT.readValue(text, out);
            return o == null ? null : usable.apply(o);
        } catch (JacksonException e) {
            return null;
        }
    }

    private OpenAiChatOptions options(ChatModel model, int tokens, ResponseFormat format, Instant deadline) {
        Duration left = Duration.between(clock.instant(), deadline);
        if (left.isNegative() || left.isZero()) throw new CustomException(ErrorCode.AI_TIMEOUT);
        return prompts.options(model, tokens, left, format);
    }

    private String call(ChatModel model, Prompt prompt) {
        var response = model.call(prompt);
        Generation result = response == null ? null : response.getResult();
        if (result == null) throw new CustomException(ErrorCode.AI_PROVIDER_UNAVAILABLE);
        if ("length".equalsIgnoreCase(result.getMetadata().getFinishReason()))
            throw new CustomException(ErrorCode.AI_OUTPUT_TRUNCATED);
        return Objects.requireNonNullElse(result.getOutput().getText(), "");
    }

    private long elapsedMs(Instant started) {
        return Duration.between(started, clock.instant()).toMillis();
    }
}
