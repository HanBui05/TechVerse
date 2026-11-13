package com.techverse.server.service.impl;

import com.techverse.server.dto.request.AiDraftRequest;
import com.techverse.server.dto.response.AiStreamEvent;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.repository.AiCompletedGenerationRepository;
import com.techverse.server.repository.TagRepository;
import com.techverse.server.repository.TopicRepository;
import com.techverse.server.service.impl.AiGenerationRegistry.CancelResult;
import com.techverse.server.service.impl.AiPromptFactory.DraftInput;
import com.techverse.server.service.impl.AiRateLimitService.Kind;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.AiRateLimitService.Reservation;

import lombok.extern.slf4j.Slf4j;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import reactor.core.Disposable;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.regex.Pattern;

/**
 * Draft generation over SSE. {@link #start} runs every check that can still answer with a plain
 * HTTP error; {@link #stream} then owns the emitter until exactly one terminal event.
 */
@Slf4j
@Service
public class AiDraftStreamService {
    private static final Pattern RAW_HTML = Pattern.compile("^<[A-Za-z!/?]");

    /**
     * The service enforces the deadline itself; the emitter outlives it a little because Spring
     * closes an emitter before its timeout callback runs, so no event could be sent from there.
     */
    public static final Duration EMITTER_GRACE = Duration.ofSeconds(5);

    /** Preflight result: the generation exists, the Author's slot and one draft use are held. */
    public record Generation(
            UUID id, UUID actor, Duration timeout, Reservation reservation, DraftInput input, ChatModel model) {
        public Quota quota() {
            return reservation.quota();
        }
    }

    private final ObjectProvider<ChatModel> chatModels;
    private final ArticleAccessService access;
    private final TopicRepository topics;
    private final TagRepository tags;
    private final AiRateLimitService limits;
    private final AiPromptFactory prompts;
    private final AiGeneratedContentValidator validator;
    private final AiProviderExceptionMapper providerErrors;
    private final AiGenerationRegistry registry;
    private final AiCompletedGenerationRepository receipts;
    private final AiAssistProperties properties;
    private final PlatformTransactionManager transactionManager;
    private final Clock clock;
    private final Executor executor;
    private final LessonAiContextService lessons;

    public AiDraftStreamService(
            ObjectProvider<ChatModel> chatModels,
            ArticleAccessService access,
            TopicRepository topics,
            TagRepository tags,
            AiRateLimitService limits,
            AiPromptFactory prompts,
            AiGeneratedContentValidator validator,
            AiProviderExceptionMapper providerErrors,
            AiGenerationRegistry registry,
            AiCompletedGenerationRepository receipts,
            AiAssistProperties properties,
            PlatformTransactionManager transactionManager,
            Clock clock,
            @Qualifier("aiSseTaskExecutor") Executor executor,
            LessonAiContextService lessons) {
        this.lessons = lessons;
        this.chatModels = chatModels;
        this.access = access;
        this.topics = topics;
        this.tags = tags;
        this.limits = limits;
        this.prompts = prompts;
        this.validator = validator;
        this.providerErrors = providerErrors;
        this.registry = registry;
        this.receipts = receipts;
        this.properties = properties;
        this.transactionManager = transactionManager;
        this.clock = clock;
        this.executor = executor;
    }

    public Generation start(UUID actor, AiDraftRequest request) {
        // Short transaction: locks are released before the provider call.
        DraftInput input =
                new TransactionTemplate(transactionManager)
                        .execute(
                                s -> {
                                    access.lockWriter(actor);
                                    if (request.isLesson()) {
                                        var ctx = lessons.resolve(actor, request.getCourseId());
                                        return new DraftInput(request, ctx.topic(), ctx.tags(), ctx.courseTitle());
                                    }
                                    var selection =
                                            AiOutlineService.select(
                                                    topics, tags, request.getTopicId(), request.getTagIds());
                                    return new DraftInput(request, selection.topic(), selection.tags(), null);
                                });
        ChatModel model = chatModels.getIfAvailable();
        if (model == null) throw new CustomException(ErrorCode.AI_CONFIGURATION_INVALID);
        Duration timeout = properties.draftTimeouts().get(request.getLength().name());
        UUID id = registry.start(actor, timeout);
        try {
            return new Generation(id, actor, timeout, limits.reserve(actor, Kind.DRAFT), input, model);
        } catch (RuntimeException e) {
            registry.finish(id);
            throw e;
        }
    }

    public void stream(Generation g, SseEmitter emitter) {
        new Run(g, emitter).begin();
    }

    public CancelResult cancel(UUID actor, UUID generationId) {
        return registry.cancel(actor, generationId);
    }

    /** One stream. Every end goes through {@link #end}, so cleanup and the terminal event happen once. */
    private final class Run {
        private final Generation g;
        private final SseEmitter emitter;
        private final StringBuilder buffer = new StringBuilder();
        private final Instant started = clock.instant();
        private boolean done;
        private boolean inFence;
        private int scanned;
        private long bytes;
        private String finishReason;
        private Disposable subscription;

        Run(Generation g, SseEmitter emitter) {
            this.g = g;
            this.emitter = emitter;
        }

        void begin() {
            registry.attach(g.id(), this::cancelByUser);
            // Fallback only: the emitter is already closed here, so the event may not reach the client.
            emitter.onTimeout(() -> fail(ErrorCode.AI_TIMEOUT));
            emitter.onError(t -> end("DISCONNECTED"));
            emitter.onCompletion(() -> end("DISCONNECTED"));
            synchronized (this) {
                if (!send(new AiStreamEvent.Metadata(g.id(), g.timeout().toSeconds()))) return;
            }
            var options =
                    prompts.options(
                            g.model(),
                            properties.maxCompletionTokens().get(g.input().request().getLength().name()),
                            g.timeout(),
                            null);
            // One absolute deadline for the whole stream; cached so each item reuses the same timer.
            Mono<Long> deadline = Mono.delay(g.timeout()).cache();
            Disposable d;
            try {
                d =
                        g.model()
                                .stream(prompts.draft(g.input(), options))
                                .subscribeOn(Schedulers.fromExecutor(executor))
                                .timeout(deadline, item -> deadline)
                                .publishOn(Schedulers.fromExecutor(executor))
                                .subscribe(this::chunk, this::failed, this::ended);
            } catch (RuntimeException e) {
                failed(e);
                return;
            }
            synchronized (this) {
                subscription = d;
                if (done) d.dispose();
            }
        }

        synchronized void chunk(ChatResponse response) {
            if (done) return;
            var result = response.getResult();
            if (result == null) return; // usage-only chunk
            String reason = result.getMetadata().getFinishReason();
            if (reason != null && !reason.isBlank()) finishReason = reason;
            // Only the assistant content is forwarded; reasoning metadata is dropped.
            String text = result.getOutput().getText();
            if (text == null || text.isEmpty()) return;
            buffer.append(text);
            bytes += text.getBytes(StandardCharsets.UTF_8).length;
            if (!quickGuard()) {
                fail(ErrorCode.AI_OUTPUT_INVALID);
                return;
            }
            send(new AiStreamEvent.Delta(text));
        }

        synchronized void ended() {
            if (done) return;
            if (finishReason == null || "length".equalsIgnoreCase(finishReason)) {
                fail(finishReason == null ? ErrorCode.AI_PROVIDER_UNAVAILABLE : ErrorCode.AI_OUTPUT_TRUNCATED);
                return;
            }
            if (!"stop".equalsIgnoreCase(finishReason)) {
                fail(ErrorCode.AI_PROVIDER_UNAVAILABLE);
                return;
            }
            String content = buffer.toString();
            if (!validator.validateDraft(content, g.input().request().getH2Headings()).isEmpty()) {
                fail(ErrorCode.AI_OUTPUT_INVALID);
                return;
            }
            var r = g.input().request();
            try {
                receipts.save(
                        g.actor(),
                        g.id(),
                        r.isLesson()
                                ? AiCompletedGenerationRepository.lessonFingerprint(
                                        r.getCourseId(), r.getTitle(), r.getSummary(), content)
                                : AiCompletedGenerationRepository.fingerprint(
                                        r.getTitle(), r.getSummary(), content, r.getTopicId(), r.getTagIds()));
            } catch (CustomException e) {
                fail(e.getErrorCode());
                return;
            }
            if (!end("COMPLETED")) return;
            send(
                    new AiStreamEvent.Completed(
                            g.id(),
                            true,
                            content.getBytes(StandardCharsets.UTF_8).length,
                            AiCompletedGenerationRepository.sha256(content),
                            g.quota().remaining()));
            emitter.complete();
        }

        synchronized void failed(Throwable t) {
            fail(providerErrors.map(t).getErrorCode());
        }

        /** Refunds the use: the provider, the output or our storage failed, not the Author. */
        synchronized void fail(ErrorCode code) {
            if (!end(code.getCode())) return;
            Quota after = limits.refund(g.reservation());
            send(
                    new AiStreamEvent.Error(
                            g.id(), code.getCode(), code.getMessage(), true, after == null ? null : after.remaining()));
            emitter.complete();
        }

        /** A started use still counts when the Author stops it, so no refund. */
        synchronized boolean cancelByUser() {
            if (!end("CANCELLED")) return false;
            send(new AiStreamEvent.Cancelled(g.id(), "USER", g.quota().remaining()));
            emitter.complete();
            return true;
        }

        /** Marks the run finished once: stops the provider and frees the Author's slot. */
        private synchronized boolean end(String outcome) {
            if (done) return false;
            done = true;
            if (subscription != null) subscription.dispose();
            registry.finish(g.id());
            log.info(
                    "AI draft generation={} actor={} outcome={} ms={}",
                    g.id(),
                    g.actor(),
                    outcome,
                    Duration.between(started, clock.instant()).toMillis());
            return true;
        }

        /** Returns false after treating a failed write as a client disconnect. */
        private boolean send(AiStreamEvent event) {
            try {
                emitter.send(SseEmitter.event().name(event.name()).data(event));
                return true;
            } catch (IOException | IllegalStateException e) {
                end("DISCONNECTED");
                return false;
            }
        }

        /**
         * Cheap early stop on new complete lines: NUL, byte cap, and image or raw HTML lines
         * outside code fences. The full validator at the end stays the source of truth.
         */
        private boolean quickGuard() {
            if (buffer.indexOf("\0") >= 0) return false;
            if (bytes > ArticleContentService.MAX_CONTENT_BYTES) return false;
            int newline;
            while ((newline = buffer.indexOf("\n", scanned)) >= 0) {
                String line = buffer.substring(scanned, newline).strip();
                scanned = newline + 1;
                if (line.startsWith("```") || line.startsWith("~~~")) inFence = !inFence;
                else if (!inFence && (line.startsWith("![") || RAW_HTML.matcher(line).find())) return false;
            }
            return true;
        }
    }
}
