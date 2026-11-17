package com.techverse.server.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.controller.LessonTutorController;
import com.techverse.server.dto.request.LessonTutorRequest;
import com.techverse.server.dto.response.AiStreamEvent;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.AiRateLimitService.Reservation;
import com.techverse.server.service.impl.LessonTutorService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(LessonTutorController.class)
@Import(LessonTutorControllerTest.MethodSecurity.class)
class LessonTutorControllerTest {
  @TestConfiguration
  @EnableMethodSecurity
  static class MethodSecurity {}

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @MockitoBean LessonTutorService service;

  final UUID actor = UUID.randomUUID();
  final UUID course = UUID.randomUUID();
  final UUID lesson = UUID.randomUUID();
  final String url = "/api/v1/courses/" + course + "/lessons/" + lesson + "/tutor:stream";

  ResultActions send(Object content, boolean signedIn) throws Exception {
    var req =
        post(url)
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content(content instanceof String s ? s : mapper.writeValueAsString(content));
    if (signedIn) req.with(jwt().jwt(j -> j.subject(actor.toString())));
    return mvc.perform(req);
  }

  ResultActions send(Object content) throws Exception {
    return send(content, true);
  }

  static Map<String, Object> turn(String role, String content) {
    var m = new java.util.HashMap<String, Object>();
    m.put("role", role);
    m.put("content", content);
    return m;
  }

  // ------------------------------------------------------------------ validation

  @Test
  void questionBoundaries() throws Exception {
    for (int len : new int[] {0, 501}) {
      send(Map.of("question", "a".repeat(len)))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
          .andExpect(jsonPath("$.fieldErrors.question").exists());
    }
    send("{}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.question").exists());
    send(Map.of("question", "   ")).andExpect(status().isBadRequest());
    verify(service, never()).start(any(), any(), any(), any());
  }

  @Test
  void historyBoundaries() throws Exception {
    var seven = IntStream.range(0, 7).mapToObj(i -> turn("USER", "x")).toList();
    send(Map.of("question", "q", "history", seven)).andExpect(status().isBadRequest());
    var nullElement = new ArrayList<Map<String, Object>>();
    nullElement.add(null);
    send(Map.of("question", "q", "history", nullElement)).andExpect(status().isBadRequest());
    send(Map.of("question", "q", "history", List.of(turn(null, "x")))).andExpect(status().isBadRequest());
    send(Map.of("question", "q", "history", List.of(turn("ROBOT", "x"))))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    send(Map.of("question", "q", "history", List.of(turn("USER", "a".repeat(2001)))))
        .andExpect(status().isBadRequest());
    send(Map.of("question", "q", "history", List.of(turn("USER", "  ")))).andExpect(status().isBadRequest());
    verify(service, never()).start(any(), any(), any(), any());
  }

  @Test
  void malformedJsonIsRejected() throws Exception {
    send("{not json").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
  }

  @Test
  void anonymousIsUnauthorized() throws Exception {
    send(Map.of("question", "q"), false).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/me/ai-tutor/quota")).andExpect(status().isUnauthorized());
  }

  @Test
  void errorsBeforeTheStreamOpensKeepTheirStatusAndCode() throws Exception {
    when(service.start(eq(actor), eq(course), eq(lesson), any()))
        .thenThrow(new CustomException(ErrorCode.AI_TUTOR_LESSON_NO_CONTENT))
        .thenThrow(new CustomException(ErrorCode.AI_QUOTA_EXCEEDED))
        .thenThrow(new CustomException(ErrorCode.LESSON_PREVIEW_ONLY));

    send(Map.of("question", "q")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AI_TUTOR_LESSON_NO_CONTENT"));
    send(Map.of("question", "q")).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("AI_QUOTA_EXCEEDED"));
    send(Map.of("question", "q")).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("LESSON_PREVIEW_ONLY"));
  }

  // ------------------------------------------------------------------ stream and quota

  @Test
  void streamsEventsWithQuotaHeaders() throws Exception {
    var generation =
        new LessonTutorService.Generation(
            UUID.randomUUID(), actor, Duration.ofSeconds(60), new Reservation("op", "k", 20, 19), null, null);
    when(service.start(eq(actor), eq(course), eq(lesson), any(LessonTutorRequest.class))).thenReturn(generation);
    doAnswer(i -> {
          SseEmitter e = i.getArgument(1);
          try {
            e.send(SseEmitter.event().name("delta").data(new AiStreamEvent.Delta("Chào")));
          } catch (IOException ex) {
            throw new java.io.UncheckedIOException(ex);
          }
          e.complete();
          return null;
        })
        .when(service)
        .stream(any(), any());

    var started =
        send(Map.of("question", "JWT là gì?"))
            .andExpect(request().asyncStarted())
            .andExpect(header().string("X-AI-Quota-Limit", "20"))
            .andExpect(header().string("X-AI-Quota-Remaining", "19"))
            .andExpect(header().string("Cache-Control", "no-cache, no-transform"))
            .andReturn();
    var done = mvc.perform(asyncDispatch(started)).andExpect(status().isOk()).andReturn();
    assertThat(done.getResponse().getContentAsString(StandardCharsets.UTF_8))
        .isEqualTo("event:delta\ndata:{\"text\":\"Chào\"}\n\n");
  }

  @Test
  void quotaEndpointReturnsLimitAndRemaining() throws Exception {
    when(service.quota(actor)).thenReturn(new Quota(20, 7));

    mvc.perform(get("/api/v1/me/ai-tutor/quota").with(jwt().jwt(j -> j.subject(actor.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.limit").value(20))
        .andExpect(jsonPath("$.data.remaining").value(7));
  }

  @Test
  void quotaEndpointMapsStorageFailureTo503() throws Exception {
    when(service.quota(actor)).thenThrow(new CustomException(ErrorCode.AI_STORAGE_UNAVAILABLE));

    mvc.perform(get("/api/v1/me/ai-tutor/quota").with(jwt().jwt(j -> j.subject(actor.toString()))))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.code").value("AI_STORAGE_UNAVAILABLE"));
  }
}
