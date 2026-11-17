package com.techverse.server.service.impl;

import com.techverse.server.dto.request.ExerciseSetRequest.AiQuestions;
import com.techverse.server.dto.request.ExerciseSetRequest.Question;
import com.techverse.server.enums.ExerciseType;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.service.AuthorAiService.QuotaAwareException;
import com.techverse.server.service.impl.AiPromptFactory.ExerciseInput;
import com.techverse.server.service.impl.AiRateLimitService.Kind;
import com.techverse.server.service.impl.AiRateLimitService.Quota;

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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;

/** AI question suggestions for an exercise set. Suggestions are never saved; only the {@code ai_assisted} flag is. */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExerciseAiService {
    private static final JsonMapper STRICT =
            JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

    record QuizItem(String content, String codeSnippet, String codeLanguage, List<String> options,
            Integer correctIndex, String explanation) {}

    record QuizOutput(List<QuizItem> questions) {}

    record CardItem(String front, String back) {}

    record CardOutput(List<CardItem> questions) {}

    /** {@code version} is the set's version after the flag was set, for the next {@code PUT questions}. */
    public record Suggestions(List<Question> questions, int requested, int version) {}

    public record Result(Suggestions body, Quota quota) {}

    private final ObjectProvider<ChatModel> chatModels;
    private final AuthorExerciseService exercises;
    private final AiRateLimitService limits;
    private final AiGenerationRegistry registry;
    private final AiPromptFactory prompts;
    private final AiProviderExceptionMapper providerErrors;
    private final AiAssistProperties properties;
    private final PlatformTransactionManager transactionManager;
    private final Clock clock;

    public Result suggest(UUID actor, UUID setId, AiQuestions r) {
        var tx = new TransactionTemplate(transactionManager);
        // Short transaction: locks are released before the provider call.
        var ctx = tx.execute(s -> exercises.aiContext(actor, setId, r.count(), r.version()));
        ChatModel model = chatModels.getIfAvailable();
        if (model == null) throw new CustomException(ErrorCode.AI_CONFIGURATION_INVALID);
        // Shares the Author's DRAFT slot, so an article draft in progress also blocks this.
        UUID slot = registry.start(actor, Kind.DRAFT, properties.exerciseTimeout());
        try {
            var reservation = limits.reserve(actor, Kind.EXERCISE);
            Instant started = clock.instant();
            try {
                var input = new ExerciseInput(ctx.type().name(), ctx.title(), ctx.description(), ctx.topic(),
                        ctx.difficulty().name(), ctx.existing(), r.instruction(), r.sourceText(), r.count());
                var usable = generate(model, ctx.type(), input, started.plus(properties.exerciseTimeout())).stream()
                        .map(q -> exercises.aiUsable(ctx.type(), q)).filter(Objects::nonNull)
                        .limit(r.count()).toList();
                if (usable.isEmpty()) throw new CustomException(ErrorCode.AI_OUTPUT_INVALID);
                int version = tx.execute(s -> exercises.markAiAssisted(actor, setId, usable.size(), r.version()));
                log.info("AI exercise actor={} outcome=OK n={} ms={}", actor, usable.size(), elapsedMs(started));
                return new Result(new Suggestions(usable, r.count(), version), reservation.quota());
            } catch (RuntimeException e) {
                Quota refunded = limits.refund(reservation);
                ErrorCode code = providerErrors.map(e).getErrorCode();
                log.info("AI exercise actor={} outcome={} ms={}", actor, code.getCode(), elapsedMs(started));
                throw refunded == null ? new CustomException(code) : new QuotaAwareException(code, refunded);
            }
        } finally {
            registry.finish(slot);
        }
    }

    private long elapsedMs(Instant started) {
        return Duration.between(started, clock.instant()).toMillis();
    }

    private List<Question> generate(ChatModel model, ExerciseType type, ExerciseInput in, Instant deadline) {
        return type == ExerciseType.FLASHCARD
                ? generate(model, in, deadline, CardOutput.class, CardOutput::questions,
                        c -> new Question(null, null, null, null, null, null, c.front(), c.back()))
                : generate(model, in, deadline, QuizOutput.class, QuizOutput::questions,
                        q -> new Question(q.content(), q.codeSnippet(), q.codeLanguage(), q.options(),
                                q.correctIndex(), q.explanation(), null, null));
    }

    /** The call and its one repair share a single deadline and a single reserved use. */
    private <O, I> List<Question> generate(ChatModel model, ExerciseInput in, Instant deadline, Class<O> out,
            Function<O, List<I>> items, Function<I, Question> map) {
        String schema = new BeanOutputConverter<>(out).getJsonSchema();
        var format = ResponseFormat.builder().type(ResponseFormat.Type.JSON_SCHEMA).jsonSchema(schema).strict(true).build();
        String text = call(model, prompts.exercise(in, schema, options(model, format, deadline)));
        var parsed = parse(text, out, items);
        if (parsed == null) {
            text = call(model, prompts.exerciseRepair(in, schema, text, options(model, format, deadline)));
            parsed = parse(text, out, items);
        }
        if (parsed == null) throw new CustomException(ErrorCode.AI_OUTPUT_INVALID);
        return parsed.stream().filter(Objects::nonNull).map(map).toList();
    }

    private <O, I> List<I> parse(String text, Class<O> out, Function<O, List<I>> items) {
        try {
            var o = STRICT.readValue(text, out);
            var list = o == null ? null : items.apply(o);
            return list == null || list.isEmpty() ? null : list;
        } catch (JacksonException e) {
            return null;
        }
    }

    private OpenAiChatOptions options(ChatModel model, ResponseFormat format, Instant deadline) {
        Duration left = Duration.between(clock.instant(), deadline);
        if (left.isNegative() || left.isZero()) throw new CustomException(ErrorCode.AI_TIMEOUT);
        return prompts.options(model, properties.exerciseTokens(), left, format);
    }

    private String call(ChatModel model, Prompt prompt) {
        var response = model.call(prompt);
        Generation result = response == null ? null : response.getResult();
        if (result == null) throw new CustomException(ErrorCode.AI_PROVIDER_UNAVAILABLE);
        if ("length".equalsIgnoreCase(result.getMetadata().getFinishReason()))
            throw new CustomException(ErrorCode.AI_OUTPUT_TRUNCATED);
        return Objects.requireNonNullElse(result.getOutput().getText(), "");
    }
}
