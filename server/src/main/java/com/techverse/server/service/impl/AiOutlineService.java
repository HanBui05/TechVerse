package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.AiOutlineModelOutput;
import com.techverse.server.dto.request.AiOutlineRequest;
import com.techverse.server.dto.response.AiOutlineResponse;
import com.techverse.server.entity.Tag;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.repository.TagRepository;
import com.techverse.server.repository.TopicRepository;
import com.techverse.server.repository.specification.TagSpecification;
import com.techverse.server.service.AuthorAiService;
import com.techverse.server.service.impl.AiPromptFactory.OutlineInput;
import com.techverse.server.service.impl.AiPromptFactory.Ref;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiOutlineService implements AuthorAiService {
    // shortcut: the prompt lists at most 100 active tags by name; page or rank them if taxonomy grows.
    private static final int MAX_PROMPT_TAGS = 100;
    private static final JsonMapper STRICT =
            JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

    private final ObjectProvider<ChatModel> chatModels;
    private final ArticleAccessService access;
    private final TopicRepository topics;
    private final TagRepository tags;
    private final AiRateLimitService limits;
    private final AiPromptFactory prompts;
    private final AiGeneratedContentValidator validator;
    private final AiProviderExceptionMapper providerErrors;
    private final AiAssistProperties properties;
    private final PlatformTransactionManager transactionManager;
    private final Clock clock;
    private final BeanOutputConverter<AiOutlineModelOutput> converter =
            new BeanOutputConverter<>(AiOutlineModelOutput.class);

    @Override
    public Outline outline(UUID actor, AiOutlineRequest request) {
        // Short transaction: locks are released before the provider call.
        OutlineInput in = new TransactionTemplate(transactionManager).execute(s -> load(actor, request));
        ChatModel model = chatModels.getIfAvailable();
        if (model == null) throw new CustomException(ErrorCode.AI_CONFIGURATION_INVALID);
        var reservation = limits.reserve(actor, Kind.OUTLINE);
        Instant started = clock.instant();
        try {
            var output = generate(model, in, started.plus(properties.outlineTimeout()));
            log.info("AI outline actor={} outcome=OK ms={}", actor, elapsedMs(started));
            return new Outline(response(output, request), reservation.quota());
        } catch (RuntimeException e) {
            Quota refunded = limits.refund(reservation);
            ErrorCode code = providerErrors.map(e).getErrorCode();
            log.info("AI outline actor={} outcome={} ms={}", actor, code.getCode(), elapsedMs(started));
            throw refunded == null ? new CustomException(code) : new QuotaAwareException(code, refunded);
        }
    }

    private long elapsedMs(Instant started) {
        return Duration.between(started, clock.instant()).toMillis();
    }

    private OutlineInput load(UUID actor, AiOutlineRequest r) {
        access.lockWriter(actor);
        var topic =
                topics.findById(r.getTopicId())
                        .orElseThrow(() -> new CustomException(ErrorCode.TOPIC_NOT_FOUND));
        if (!topic.isActive()) throw new CustomException(ErrorCode.ARTICLE_ASSOCIATION_INACTIVE);
        Map<UUID, Tag> selected =
                tags.findAllById(r.getTagIds()).stream()
                        .collect(Collectors.toMap(Tag::getId, Function.identity()));
        if (selected.size() != r.getTagIds().size()) throw new CustomException(ErrorCode.TAG_NOT_FOUND);
        if (selected.values().stream().anyMatch(t -> !t.isActive()))
            throw new CustomException(ErrorCode.ARTICLE_ASSOCIATION_INACTIVE);
        var active =
                tags.findAll(
                                TagSpecification.hasActiveStatus(true),
                                PageRequest.of(0, MAX_PROMPT_TAGS, Sort.by("name")))
                        .map(t -> new Ref(t.getId(), t.getName()))
                        .toList();
        return new OutlineInput(
                r,
                new Ref(topic.getId(), topic.getName()),
                r.getTagIds().stream().map(id -> new Ref(id, selected.get(id).getName())).toList(),
                active);
    }

    /** Both the call and its repair share one endpoint deadline. */
    private AiOutlineModelOutput generate(ChatModel model, OutlineInput in, Instant deadline) {
        String schema = converter.getJsonSchema();
        var format =
                ResponseFormat.builder()
                        .type(ResponseFormat.Type.JSON_SCHEMA)
                        .jsonSchema(schema)
                        .strict(true)
                        .build();
        String text =
                call(model, prompts.outline(in, schema, options(model, format, deadline)));
        var errors = new ArrayList<String>();
        var output = parse(text, in, errors);
        if (output != null) return output;
        // One explicit repair call; it is part of the same reserved use, not a retry.
        String repaired =
                call(
                        model,
                        prompts.outlineRepair(
                                in, schema, text, errors, options(model, format, deadline)));
        output = parse(repaired, in, new ArrayList<>());
        if (output == null) throw new CustomException(ErrorCode.AI_OUTPUT_INVALID);
        return output;
    }

    private OpenAiChatOptions options(ChatModel model, ResponseFormat format, Instant deadline) {
        Duration left = Duration.between(clock.instant(), deadline);
        if (left.isNegative() || left.isZero()) throw new CustomException(ErrorCode.AI_TIMEOUT);
        return prompts.options(model, properties.outlineTokens(), left, format);
    }

    private String call(ChatModel model, Prompt prompt) {
        var response = model.call(prompt);
        Generation result = response == null ? null : response.getResult();
        if (result == null) throw new CustomException(ErrorCode.AI_PROVIDER_UNAVAILABLE);
        if ("length".equalsIgnoreCase(result.getMetadata().getFinishReason()))
            throw new CustomException(ErrorCode.AI_OUTPUT_TRUNCATED);
        return Objects.requireNonNullElse(result.getOutput().getText(), "");
    }

    /** Returns null and fills {@code errors} when the output is unusable. */
    private AiOutlineModelOutput parse(String text, OutlineInput in, List<String> errors) {
        AiOutlineModelOutput output;
        try {
            output = STRICT.readValue(text, AiOutlineModelOutput.class);
        } catch (JacksonException e) {
            errors.add("Output is not JSON matching outputSchema (no extra fields allowed)");
            return null;
        }
        if (output == null) {
            errors.add("Output is not JSON matching outputSchema");
            return null;
        }
        errors.addAll(
                validator.validateOutline(
                        output,
                        in.topic().id(),
                        in.request().getTagIds(),
                        in.activeTags().stream().map(Ref::id).collect(Collectors.toSet())));
        return errors.isEmpty() ? output : null;
    }

    private static AiOutlineResponse response(AiOutlineModelOutput o, AiOutlineRequest r) {
        return new AiOutlineResponse(
                o.title().strip(),
                o.summary().strip(),
                r.getTopicId(),
                List.copyOf(r.getTagIds()),
                List.copyOf(o.suggestedTagIds()),
                o.sections().stream()
                        .map(
                                s ->
                                        new AiOutlineResponse.Section(
                                                s.heading().strip(),
                                                s.subsections().stream().map(String::strip).toList()))
                        .toList());
    }
}
