package com.techverse.server.ai;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import com.techverse.server.dto.response.AiQuotaResponse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.controller.AuthorAiController;
import com.techverse.server.dto.request.AiDraftRequest;
import com.techverse.server.dto.request.AiOutlineRequest;
import com.techverse.server.dto.response.AiStreamEvent;
import com.techverse.server.service.impl.AiDraftStreamService;
import com.techverse.server.service.impl.AiGenerationRegistry.CancelResult;
import com.techverse.server.service.impl.AiRateLimitService.Reservation;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.mock.web.MockAsyncContext;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.techverse.server.dto.response.AiOutlineResponse;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.service.AuthorAiService;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(AuthorAiController.class)
@Import(AuthorAiControllerTest.MethodSecurity.class)
class AuthorAiControllerTest {
  static final String URL = "/api/v1/author/ai/outlines";

  @TestConfiguration
  @EnableMethodSecurity
  static class MethodSecurity {}

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @MockitoBean AuthorAiService service;
  @MockitoBean AiDraftStreamService drafts;

  final UUID actor = UUID.randomUUID();
  final UUID topic = UUID.randomUUID();
  final UUID tag = UUID.randomUUID();

  Map<String, Object> body() {
    var b = new HashMap<String, Object>();
    b.put("title", "Spring Security cho người mới");
    b.put("topicId", topic.toString());
    b.put("tagIds", List.of(tag.toString()));
    b.put("idea", "Giải thích cách JWT và refresh token phối hợp.");
    b.put("length", "MEDIUM");
    b.put("targetAudience", "Sinh viên");
    return b;
  }

  Map<String, Object> body(Consumer<Map<String, Object>> change) {
    var b = body();
    change.accept(b);
    return b;
  }

  ResultActions send(Object content, String role) throws Exception {
    return mvc.perform(post(URL)
        .with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority(role)))
        .with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content(content instanceof String s ? s : mapper.writeValueAsString(content)));
  }

  ResultActions send(Object content) throws Exception {
    return send(content, "ROLE_AUTHOR");
  }

  void stubOk() {
    when(service.outline(eq(actor), any(AiOutlineRequest.class))).thenReturn(new AuthorAiService.Outline(
        new AiOutlineResponse("Tiêu đề", "Tóm tắt", topic, List.of(tag), List.of(),
            List.of(new AiOutlineResponse.Section("Mục một dài", List.of("Ý con")))),
        new Quota(10, 7)));
  }

  @Test
  void successReturnsEnvelopeAndQuotaHeaders() throws Exception {
    stubOk();
    send(body())
        .andExpect(status().isOk())
        .andExpect(header().string("X-AI-Quota-Limit", "10"))
        .andExpect(header().string("X-AI-Quota-Remaining", "7"))
        .andExpect(jsonPath("$.status").value(200))
        .andExpect(jsonPath("$.message").value("AI outline generated"))
        .andExpect(jsonPath("$.data.topicId").value(topic.toString()))
        .andExpect(jsonPath("$.data.tagIds[0]").value(tag.toString()))
        .andExpect(jsonPath("$.data.suggestedTagIds").isArray())
        .andExpect(jsonPath("$.data.sections[0].heading").value("Mục một dài"))
        .andExpect(jsonPath("$.data.sections[0].subsections[0]").value("Ý con"));
  }

  @Test
  void optionalFieldsMayBeOmittedAndInputIsTrimmed() throws Exception {
    stubOk();
    send(body(b -> {
      b.remove("title");
      b.remove("tagIds");
      b.put("idea", "   " + "x".repeat(20) + "   ");
    })).andExpect(status().isOk());
    verify(service).outline(eq(actor), org.mockito.ArgumentMatchers.argThat(r ->
        r.getTitle() == null && r.getTagIds().isEmpty() && r.getIdea().equals("x".repeat(20))));
  }

  @Test
  void boundariesAreValidationErrorsPerField() throws Exception {
    stubOk();
    send(body(b -> b.put("idea", "x".repeat(4000)))).andExpect(status().isOk());
    send(body(b -> b.put("targetAudience", "abc"))).andExpect(status().isOk());

    Map<String, Consumer<Map<String, Object>>> invalid = Map.of(
        "idea", b -> b.put("idea", "x".repeat(19)),
        "title", b -> b.put("title", "    abcd    "),
        "targetAudience", b -> b.put("targetAudience", "x".repeat(201)),
        "tagIds", b -> b.put("tagIds", IntStream.range(0, 11).mapToObj(i -> UUID.randomUUID().toString()).toList()),
        "distinctTags", b -> b.put("tagIds", List.of(tag.toString(), tag.toString())),
        "length", b -> b.put("length", "HUGE"),
        "topicId", b -> b.remove("topicId"));
    for (var entry : invalid.entrySet()) {
      send(body(entry.getValue()))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
          .andExpect(jsonPath("$.fieldErrors." + entry.getKey()).exists());
    }
  }

  @Test
  void unknownNullAndBrokenBodiesAreMalformed() throws Exception {
    for (Object content : List.of(
        body(b -> b.put("action", "SUBMIT")),
        body(b -> b.put("idea", null)),
        body(b -> b.put("tagIds", null)),
        "{\"idea\": ")) {
      send(content)
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }
    verify(service, never()).outline(any(), any());
  }

  @Test
  void nonAuthorRoleIsForbidden() throws Exception {
    send(body(), "ROLE_LEARNER")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    verify(service, never()).outline(any(), any());
  }

  @Test
  void serviceErrorsUseTheStandardErrorEnvelope() throws Exception {
    when(service.outline(any(), any())).thenThrow(new CustomException(ErrorCode.AI_QUOTA_EXCEEDED));
    send(body())
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.status").value(429))
        .andExpect(jsonPath("$.code").value("AI_QUOTA_EXCEEDED"))
        .andExpect(header().doesNotExist("X-AI-Quota-Remaining"));

    org.mockito.Mockito.doThrow(new AuthorAiService.QuotaAwareException(ErrorCode.AI_OUTPUT_INVALID, new Quota(10, 10)))
        .when(service).outline(any(), any());
    send(body())
        .andExpect(status().isUnprocessableContent())
        .andExpect(jsonPath("$.code").value("AI_OUTPUT_INVALID"))
        .andExpect(header().string("X-AI-Quota-Limit", "10"))
        .andExpect(header().string("X-AI-Quota-Remaining", "10"));
  }

  // ---- Draft stream ----

  static final String DRAFT_URL = "/api/v1/author/ai/drafts:stream";
  final UUID generationId = UUID.randomUUID();

  Map<String, Object> draftBody(Consumer<Map<String, Object>> change) {
    var b = body();
    b.put("summary", "s".repeat(60));
    b.put("sections", List.of(
        Map.of("heading", "Mục thứ nhất", "subsections", List.of("Ý con một")),
        Map.of("heading", "Mục thứ hai"),
        Map.of("heading", "Mục thứ ba", "subsections", List.of())));
    change.accept(b);
    return b;
  }

  ResultActions sendDraft(Object content, String role) throws Exception {
    return mvc.perform(post(DRAFT_URL)
        .with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority(role)))
        .with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_JSON)
        .content(content instanceof String s ? s : mapper.writeValueAsString(content)));
  }

  ResultActions sendDraft(Object content) throws Exception {
    return sendDraft(content, "ROLE_AUTHOR");
  }

  /** The emitter the controller handed to the service. */
  final AtomicReference<SseEmitter> emitter = new AtomicReference<>();

  void stubStream(Consumer<SseEmitter> behaviour) {
    when(drafts.start(eq(actor), any(AiDraftRequest.class))).thenReturn(new AiDraftStreamService.Generation(
        generationId, actor, Duration.ofSeconds(120), new Reservation("op", "k", 5, 4), null, null));
    doAnswer(i -> {
      SseEmitter e = i.getArgument(1);
      emitter.set(e);
      behaviour.accept(e);
      return null;
    }).when(drafts).stream(any(), any());
  }

  static void event(SseEmitter e, AiStreamEvent event) {
    try {
      e.send(SseEmitter.event().name(event.name()).data(event));
    } catch (IOException ex) {
      throw new UncheckedIOException(ex);
    }
  }

  static String text(MvcResult r) throws Exception {
    return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
  }

  @Test
  void draftStreamsTypedJsonEventsAfterAsyncDispatch() throws Exception {
    stubStream(e -> {
      event(e, new AiStreamEvent.Metadata(generationId, 120));
      event(e, new AiStreamEvent.Delta("## Mục \"một\"\n\ndata: giả\n"));
      event(e, new AiStreamEvent.Completed(generationId, true, 42, "ab", 4));
      e.complete();
    });

    MvcResult started = sendDraft(draftBody(b -> {}))
        .andExpect(request().asyncStarted())
        .andExpect(header().string("X-AI-Quota-Limit", "5"))
        .andExpect(header().string("X-AI-Quota-Remaining", "4"))
        .andExpect(header().string("Cache-Control", "no-cache, no-transform"))
        .andExpect(header().string("X-Accel-Buffering", "no"))
        .andReturn();
    assertThat(emitter.get().getTimeout()).isEqualTo(125_000L);

    MvcResult done = mvc.perform(asyncDispatch(started))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Type", "text/event-stream;charset=UTF-8"))
        .andReturn();
    String id = generationId.toString();
    assertThat(text(done)).isEqualTo(
        "event:metadata\ndata:{\"generationId\":\"" + id + "\",\"timeoutSeconds\":120}\n\n"
            + "event:delta\ndata:{\"text\":\"## Mục \\\"một\\\"\\n\\ndata: giả\\n\"}\n\n"
            + "event:completed\ndata:{\"generationId\":\"" + id
            + "\",\"validated\":true,\"contentBytes\":42,\"contentSha256\":\"ab\",\"quotaRemaining\":4}\n\n");
  }

  List<AsyncListener> listeners(MvcResult started) {
    return ((MockAsyncContext) started.getRequest().getAsyncContext()).getListeners();
  }

  /**
   * Spring closes the emitter before the timeout callback runs, so the callback can only clean
   * up; that is why the service enforces the deadline itself and the emitter gets a grace period.
   */
  @Test
  void containerTimeoutRunsTheEmitterTimeoutCallbackOnAClosedEmitter() throws Exception {
    var sendFailed = new AtomicBoolean();
    stubStream(e -> {
      event(e, new AiStreamEvent.Metadata(generationId, 120));
      e.onTimeout(() -> {
        try {
          event(e, new AiStreamEvent.Error(generationId, "AI_TIMEOUT", "AI took too long to respond", true, 5));
        } catch (IllegalStateException ex) {
          sendFailed.set(true);
        }
      });
    });
    MvcResult started = sendDraft(draftBody(b -> {})).andExpect(request().asyncStarted()).andReturn();
    var context = started.getRequest().getAsyncContext();
    for (var l : listeners(started)) l.onTimeout(new AsyncEvent(context));

    assertThat(sendFailed).isTrue();
    assertThat(text(started)).startsWith("event:metadata").doesNotContain("event:error");
  }

  @Test
  void clientDisconnectRunsTheEmitterErrorCallback() throws Exception {
    var disconnected = new AtomicBoolean();
    stubStream(e -> {
      event(e, new AiStreamEvent.Metadata(generationId, 120));
      e.onError(t -> disconnected.set(true));
    });
    MvcResult started = sendDraft(draftBody(b -> {})).andExpect(request().asyncStarted()).andReturn();
    var context = started.getRequest().getAsyncContext();
    for (var l : listeners(started)) l.onError(new AsyncEvent(context, new IOException("broken pipe")));
    assertThat(disconnected).isTrue();
  }

  @Test
  void preStreamErrorsAreStandardErrorResponses() throws Exception {
    when(drafts.start(any(), any())).thenThrow(new CustomException(ErrorCode.AI_GENERATION_IN_PROGRESS));
    sendDraft(draftBody(b -> {}))
        .andExpect(request().asyncNotStarted())
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("AI_GENERATION_IN_PROGRESS"))
        .andExpect(jsonPath("$.path").value(DRAFT_URL));
    verify(drafts, never()).stream(any(), any());
  }

  @Test
  void draftValidationErrorsArePerField() throws Exception {
    Map<String, Consumer<Map<String, Object>>> invalid = Map.of(
        "summary", b -> b.put("summary", "s".repeat(49)),
        "sections", b -> b.put("sections", List.of(Map.of("heading", "Mục thứ nhất"), Map.of("heading", "Mục thứ hai"))),
        "sections[0].heading", b -> b.put("sections", List.of(
            Map.of("heading", "Ngắn"), Map.of("heading", "Mục thứ hai"), Map.of("heading", "Mục thứ ba"))),
        "sections[0].subsections", b -> b.put("sections", List.of(
            Map.of("heading", "Mục thứ nhất", "subsections", List.of("Con số 1", "Con số 2", "Con số 3", "Con số 4", "Con số 5")),
            Map.of("heading", "Mục thứ hai"), Map.of("heading", "Mục thứ ba"))),
        "distinctHeadings", b -> b.put("sections", List.of(
            Map.of("heading", "Mục thứ nhất"), Map.of("heading", "MỤC THỨ NHẤT"), Map.of("heading", "Mục thứ ba"))),
        "length", b -> b.put("length", "HUGE"));
    for (var entry : invalid.entrySet()) {
      sendDraft(draftBody(entry.getValue()))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
          .andExpect(jsonPath("$.fieldErrors['" + entry.getKey() + "']").exists());
    }
    verify(drafts, never()).start(any(), any());
  }

  @Test
  void draftBodyOverSixteenKibIsRejected() throws Exception {
    String json = mapper.writeValueAsString(draftBody(b -> {}));
    String padded = json.substring(0, json.length() - 1) + " ".repeat(16 * 1024) + "}";
    sendDraft(padded)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.body").exists());
    verify(drafts, never()).start(any(), any());
  }

  @Test
  void draftUnknownOrNullNestedFieldsAreMalformed() throws Exception {
    for (Object content : List.of(
        draftBody(b -> b.put("action", "SUBMIT")),
        draftBody(b -> b.put("sections", List.of(Map.of("heading", "Mục thứ nhất", "extra", 1)))),
        draftBody(b -> b.put("summary", null)))) {
      sendDraft(content).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    }
  }

  ResultActions cancel(UUID id, String role) throws Exception {
    return mvc.perform(delete("/api/v1/author/ai/generations/" + id)
        .with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority(role)))
        .with(csrf()));
  }

  @Test
  void nonAuthorCannotStreamOrCancel() throws Exception {
    sendDraft(draftBody(b -> {}), "ROLE_LEARNER").andExpect(status().isForbidden());
    cancel(generationId, "ROLE_LEARNER").andExpect(status().isForbidden());
    verify(drafts, never()).start(any(), any());
    verify(drafts, never()).cancel(any(), any());
  }

  @Test
  void cancelReportsStatusOrNotFound() throws Exception {
    when(drafts.cancel(actor, generationId)).thenReturn(CancelResult.CANCELLED);
    cancel(generationId, "ROLE_AUTHOR")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.message").value("AI generation cancellation processed"))
        .andExpect(jsonPath("$.data.generationId").value(generationId.toString()))
        .andExpect(jsonPath("$.data.status").value("CANCELLED"));

    when(drafts.cancel(actor, generationId)).thenReturn(CancelResult.ALREADY_FINISHED);
    cancel(generationId, "ROLE_AUTHOR").andExpect(jsonPath("$.data.status").value("ALREADY_FINISHED"));

    var other = UUID.randomUUID();
    when(drafts.cancel(actor, other)).thenThrow(new CustomException(ErrorCode.AI_GENERATION_NOT_FOUND));
    cancel(other, "ROLE_AUTHOR")
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("AI_GENERATION_NOT_FOUND"));
  }

  @Test
  void quotaReturnsBothAllowancesInTheEnvelope() throws Exception {
    when(service.quota(actor)).thenReturn(new AiQuotaResponse(new Quota(10, 7), new Quota(5, 4)));
    mvc.perform(get("/api/v1/author/ai/quota")
            .with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority("ROLE_AUTHOR"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value(200))
        .andExpect(jsonPath("$.data.outline.limit").value(10))
        .andExpect(jsonPath("$.data.outline.remaining").value(7))
        .andExpect(jsonPath("$.data.draft.limit").value(5))
        .andExpect(jsonPath("$.data.draft.remaining").value(4));
  }

  @Test
  void nonAuthorCannotReadQuota() throws Exception {
    mvc.perform(get("/api/v1/author/ai/quota")
            .with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority("ROLE_LEARNER"))))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    verify(service, never()).quota(any());
  }
}
