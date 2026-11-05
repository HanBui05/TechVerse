package com.techverse.server.ai;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.controller.AuthorAiController;
import com.techverse.server.dto.request.AiOutlineRequest;
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
}
