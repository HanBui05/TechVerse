package com.techverse.server.service.impl;

import com.techverse.server.dto.request.LessonTutorRequest;
import com.techverse.server.dto.response.AiStreamEvent;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.AiAssistProperties;
import com.techverse.server.repository.AiCompletedGenerationRepository;
import com.techverse.server.service.PublishedCourseService;
import com.techverse.server.service.impl.AiPromptFactory.TutorInput;
import com.techverse.server.service.impl.AiRateLimitService.Kind;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.AiRateLimitService.Reservation;

import lombok.extern.slf4j.Slf4j;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
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

/**
 * Answers a learner's question about one lesson over SSE. {@link #start} runs every check that can
 * still answer with a plain HTTP error; {@link #stream} then owns the emitter until one terminal
 * event. Nothing is stored; the lesson text comes from the public snapshot.
 */
@Slf4j
@Service
public class LessonTutorService {
    /** Preflight result: the Learner's tutor slot and one use are held. */
    public record Generation(
            UUID id, UUID actor, Duration timeout, Reservation reservation, TutorInput input, ChatModel model) {
        public Quota quota() {
            return reservation.quota();
        }
    }

    private final ObjectProvider<ChatModel> chatModels;
    private final PublishedCourseService courses;
    private final AiRateLimitService limits;
    private final AiPromptFactory prompts;
    private final AiProviderExceptionMapper providerErrors;
    private final AiGenerationRegistry registry;
    private final AiAssistProperties properties;
    private final Clock clock;
    private final Executor executor;

    public LessonTutorService(
            ObjectProvider<ChatModel> chatModels,
            PublishedCourseService courses,
            AiRateLimitService limits,
            AiPromptFactory prompts,
            AiProviderExceptionMapper providerErrors,
            AiGenerationRegistry registry,
            AiAssistProperties properties,
            Clock clock,
            @Qualifier("aiSseTaskExecutor") Executor executor) {
        this.chatModels = chatModels;
        this.courses = courses;
        this.limits = limits;
        this.prompts = prompts;
        this.providerErrors = providerErrors;
        this.registry = registry;
        this.properties = properties;
        this.clock = clock;
        this.executor = executor;
    }

    public Generation start(UUID actor, UUID courseId, UUID lessonId, LessonTutorRequest request) {
        // The course service reads in its own short transaction; none is open during the model call.
        var lesson = courses.tutorLesson(actor, courseId, lessonId);
        if (lesson.content() == null || lesson.content().isBlank())
            throw new CustomException(ErrorCode.AI_TUTOR_LESSON_NO_CONTENT);
        ChatModel model = chatModels.getIfAvailable();
        if (model == null) throw new CustomException(ErrorCode.AI_CONFIGURATION_INVALID);
        Duration timeout = properties.tutorTimeout();
        UUID id = registry.start(actor, Kind.TUTOR, timeout);
        try {
            var input = new TutorInput(request, lesson.courseTitle(), lesson.title(), lesson.summary(), lesson.content());
            return new Generation(id, actor, timeout, limits.reserve(actor, Kind.TUTOR), input, model);
        } catch (RuntimeException e) {
            registry.finish(id);
            throw e;
        }
    }

    public Quota quota(UUID actor) {
        return limits.peek(actor, Kind.TUTOR);
    }

    public void stream(Generation g, SseEmitter emitter) {
        new Run(g, emitter).begin();
    }

    /** One stream. Every end goes through {@link #end}, so cleanup and the terminal event happen once. */
    private final class Run {
        private final Generation g;
        private final SseEmitter emitter;
        private final StringBuilder answer = new StringBuilder();
        private final Instant started = clock.instant();
        private boolean done;
        private boolean deltaSent;
        private String finishReason;
        private Disposable subscription;

        Run(Generation g, SseEmitter emitter) {
            this.g = g;
            this.emitter = emitter;
        }

        void begin() {
            // Fallback only: the emitter is already closed here, so the event may not reach the client.
            emitter.onTimeout(() -> fail(ErrorCode.AI_TIMEOUT));
            emitter.onError(t -> disconnected());
            emitter.onCompletion(this::disconnected);
            var options = prompts.options(g.model(), properties.tutorTokens(), g.timeout(), null);
            var tutor = prompts.tutor(g.input(), options);
            synchronized (this) {
                if (!send(new AiStreamEvent.Metadata(g.id(), g.timeout().toSeconds(), tutor.contextTruncated())))
                    return;
            }
            // One absolute deadline for the whole stream; cached so each item reuses the same timer.
            Mono<Long> deadline = Mono.delay(g.timeout()).cache();
            Disposable d;
            try {
                d =
                        g.model()
                                .stream(tutor.prompt())
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
            answer.append(text);
            if (send(new AiStreamEvent.Delta(text))) deltaSent = true;
        }

        synchronized void ended() {
            if (done) return;
            if (finishReason == null) fail(ErrorCode.AI_PROVIDER_UNAVAILABLE);
            else if ("length".equalsIgnoreCase(finishReason)) fail(ErrorCode.AI_OUTPUT_TRUNCATED);
            else if (!"stop".equalsIgnoreCase(finishReason) || answer.isEmpty()) fail(ErrorCode.AI_PROVIDER_UNAVAILABLE);
            else {
                if (!end("COMPLETED")) return;
                String text = answer.toString();
                send(
                        new AiStreamEvent.Completed(
                                g.id(),
                                true,
                                text.getBytes(StandardCharsets.UTF_8).length,
                                AiCompletedGenerationRepository.sha256(text),
                                g.quota().remaining()));
                emitter.complete();
            }
        }

        synchronized void failed(Throwable t) {
            fail(providerErrors.map(t).getErrorCode());
        }

        /** Refunds the use: the provider or the output failed, not the learner. */
        synchronized void fail(ErrorCode code) {
            if (!end(code.getCode())) return;
            Quota after = limits.refund(g.reservation());
            send(
                    new AiStreamEvent.Error(
                            g.id(), code.getCode(), code.getMessage(), true, after == null ? null : after.remaining()));
            emitter.complete();
        }

        /** The learner left: the use is refunded only if they never received any text. */
        private synchronized void disconnected() {
            if (end("DISCONNECTED") && !deltaSent) limits.refund(g.reservation());
        }

        /** Marks the run finished once: stops the provider and frees the learner's slot. */
        private synchronized boolean end(String outcome) {
            if (done) return false;
            done = true;
            if (subscription != null) subscription.dispose();
            registry.finish(g.id());
            log.info(
                    "AI tutor generation={} actor={} outcome={} ms={}",
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
                disconnected();
                return false;
            }
        }
    }
}
