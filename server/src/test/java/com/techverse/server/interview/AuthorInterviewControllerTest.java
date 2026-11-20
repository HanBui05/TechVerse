package com.techverse.server.interview;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.AuthorInterviewController;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.AuthorInterviewService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.ObjectMapper;

import java.util.*;

@WebMvcTest(AuthorInterviewController.class)
@Import(AuthorInterviewControllerTest.MethodSecurity.class)
class AuthorInterviewControllerTest {
    static final String ROOT = "/api/v1/author/interview-questions";

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean AuthorInterviewService service;
    @MockitoBean com.techverse.server.service.impl.InterviewAiService ai;

    final UUID actor = UUID.randomUUID();
    final UUID id = UUID.randomUUID();

    ResultActions call(MockHttpServletRequestBuilder req, Object body, String role) throws Exception {
        return mvc.perform(req.with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority(role)))
                .with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body instanceof String s ? s : mapper.writeValueAsString(body)));
    }

    Map<String, Object> create(String key, Object value) {
        var b = new HashMap<String, Object>(Map.of("topicId", UUID.randomUUID().toString(), "level", "EASY",
                "question", "What is a JVM?", "sampleAnswer", "A virtual machine that runs bytecode."));
        if (value == null) b.remove(key);
        else b.put(key, value);
        return b;
    }

    void badRequest(MockHttpServletRequestBuilder req, Object body) throws Exception {
        call(req, body, "ROLE_AUTHOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void createValidatesEveryFieldAtItsBounds() throws Exception {
        for (var bad : List.of(create("topicId", null), create("topicId", "not-a-uuid"), create("level", null), create("level", "EXTREME"),
                create("question", null), create("question", "123456789"), create("question", "   123456789   "), create("question", "x".repeat(1001)),
                create("sampleAnswer", null), create("sampleAnswer", "x".repeat(19)), create("sampleAnswer", "x".repeat(5001)),
                create("hint", "x".repeat(501))))
            badRequest(post(ROOT), bad);
        for (var ok : List.of(create("question", "x".repeat(10)), create("question", "x".repeat(1000)), create("sampleAnswer", "x".repeat(20)),
                create("sampleAnswer", "x".repeat(5000)), create("hint", "x".repeat(500)), create("hint", "")))
            call(post(ROOT), ok, "ROLE_AUTHOR").andExpect(status().isCreated());
    }

    @Test
    void patchRequiresAVersionAndValidatesPresentFields() throws Exception {
        badRequest(patch(ROOT + "/" + id), Map.of("level", "HARD"));
        badRequest(patch(ROOT + "/" + id), Map.of("version", -1));
        badRequest(patch(ROOT + "/" + id), "{\"version\":0.9}");
        badRequest(patch(ROOT + "/" + id), "{\"version\":1e20}");
        badRequest(patch(ROOT + "/" + id), Map.of("version", 0, "question", "short"));
        badRequest(patch(ROOT + "/" + id), Map.of("version", 0, "topicId", "nope"));
        badRequest(patch(ROOT + "/" + id), Map.of("version", 0, "hint", "x".repeat(501)));
        call(patch(ROOT + "/" + id), Map.of("version", 0, "level", "HARD"), "ROLE_AUTHOR").andExpect(status().isOk());
    }

    @Test
    void visibilityActionIsRequiredAndOnlyHideOrUnhide() throws Exception {
        String url = ROOT + "/" + id + "/visibility";
        for (var bad : List.of(Map.of(), Map.of("action", "REMOVE"), Map.of("action", "RESTORE"), Map.of("action", "nope")))
            badRequest(patch(url), bad);
        call(patch(url), Map.of("action", "HIDE"), "ROLE_AUTHOR").andExpect(status().isOk());
    }

    @Test
    void listRejectsBadFilters() throws Exception {
        for (String q : List.of("page=-1", "size=0", "size=51", "status=NOPE", "level=NOPE", "topicId=nope", "keyword=" + "x".repeat(101)))
            mvc.perform(get(ROOT + "?" + q).with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority("ROLE_AUTHOR"))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void writesNeedTheAuthorRoleAndLoginIsRequired() throws Exception {
        call(post(ROOT), create("level", "EASY"), "ROLE_LEARNER").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(post(ROOT).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()); // body codes need the real entry point: see the integration test
    }

    @Test
    void mapsServiceErrors() throws Exception {
        when(service.submit(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.INTERVIEW_TOPIC_INACTIVE));
        call(post(ROOT + "/" + id + "/submit"), "{}", "ROLE_AUTHOR").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_TOPIC_INACTIVE"));
        when(service.copy(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.INTERVIEW_RATE_LIMITED));
        call(post(ROOT + "/" + id + "/copy"), "{}", "ROLE_AUTHOR").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("INTERVIEW_RATE_LIMITED"));
        when(service.withdraw(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.INTERVIEW_STORAGE_UNAVAILABLE));
        call(post(ROOT + "/" + id + "/withdraw"), "{}", "ROLE_AUTHOR").andExpect(status().isServiceUnavailable());
        when(service.update(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.INTERVIEW_VERSION_CONFLICT));
        call(patch(ROOT + "/" + id), Map.of("version", 3), "ROLE_AUTHOR").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_VERSION_CONFLICT"));
        when(service.detail(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        call(get(ROOT + "/" + id), null, "ROLE_AUTHOR").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INTERVIEW_QUESTION_NOT_FOUND"));
        when(service.create(eq(actor), any())).thenThrow(new CustomException(ErrorCode.INTERVIEW_CONTENT_INVALID));
        call(post(ROOT), create("level", "EASY"), "ROLE_AUTHOR").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_CONTENT_INVALID"));
    }
}
