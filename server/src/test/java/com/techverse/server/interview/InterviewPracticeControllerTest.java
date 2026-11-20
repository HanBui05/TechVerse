package com.techverse.server.interview;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.*;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.*;

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

/** HTTP-level rules of the moderator and public interview controllers (validation, roles, error mapping). */
@WebMvcTest({ModeratorInterviewController.class, PublishedInterviewController.class})
@Import(InterviewPracticeControllerTest.MethodSecurity.class)
class InterviewPracticeControllerTest {
    static final String MOD = "/api/v1/moderator/interview-questions";
    static final String PUB = "/api/v1/interview-questions";
    static final String TOKEN = "a".repeat(64);

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean ModeratorInterviewService moderator;
    @MockitoBean PublishedInterviewService practice;

    final UUID actor = UUID.randomUUID();
    final UUID id = UUID.randomUUID();

    ResultActions call(MockHttpServletRequestBuilder req, Object body, String role) throws Exception {
        req.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body instanceof String s ? s : mapper.writeValueAsString(body));
        if (role != null) req.with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority(role)));
        return mvc.perform(req);
    }

    ResultActions get(String path, String role) throws Exception {
        var req = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path);
        if (role != null) req.with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority(role)));
        return mvc.perform(req);
    }

    void badRequest(MockHttpServletRequestBuilder req, Object body, String role) throws Exception {
        call(req, body, role).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void moderatorBodiesAreValidated() throws Exception {
        for (var bad : List.of(Map.of("decision", "APPROVE"), Map.of("reviewToken", TOKEN), Map.of("decision", "MAYBE", "reviewToken", TOKEN),
                Map.of("decision", "APPROVE", "reviewToken", "XYZ"), Map.of("decision", "APPROVE", "reviewToken", TOKEN, "note", "x".repeat(1001))))
            badRequest(patch(MOD + "/" + id + "/review"), bad, "ROLE_MODERATOR");
        for (var bad : List.of(Map.of("action", "HIDE"), Map.of("reviewToken", TOKEN), Map.of("action", "UNHIDE", "reviewToken", TOKEN),
                Map.of("action", "HIDE", "reviewToken", TOKEN, "reason", "x".repeat(1001))))
            badRequest(patch(MOD + "/" + id + "/publication"), bad, "ROLE_MODERATOR");
        call(patch(MOD + "/" + id + "/review"), Map.of("decision", "APPROVE", "reviewToken", TOKEN, "note", "x".repeat(1000)), "ROLE_MODERATOR")
                .andExpect(status().isOk());
        call(patch(MOD + "/" + id + "/publication"), Map.of("action", "RESTORE", "reviewToken", TOKEN), "ROLE_MODERATOR").andExpect(status().isOk());
        for (String q : List.of("page=-1", "size=0", "size=51", "status=NOPE", "level=NOPE", "topicId=abc", "keyword=" + "x".repeat(101)))
            get(MOD + "?" + q, "ROLE_MODERATOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void moderatorRoutesNeedTheModeratorRole() throws Exception {
        call(patch(MOD + "/" + id + "/review"), Map.of("decision", "APPROVE", "reviewToken", TOKEN), "ROLE_ADMIN").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(MOD, "ROLE_AUTHOR").andExpect(status().isForbidden());
        get(MOD, null).andExpect(status().isUnauthorized()); // body codes need the real entry point: see the integration test
    }

    @Test
    void publicRoutesValidateFiltersAndMarkBodies() throws Exception {
        // @WebMvcTest has no SecurityConfiguration (guest reads are permitAll there): see the integration test.
        get(PUB + "/" + id + "/answer", null).andExpect(status().isUnauthorized());
        call(put(PUB + "/" + id + "/mark"), Map.of("saved", true), null).andExpect(status().isUnauthorized());
        for (String q : List.of("page=-1", "size=0", "size=51", "level=NOPE", "mark=NOPE", "topicId=abc", "keyword=" + "x".repeat(101)))
            get(PUB + "?" + q, "ROLE_LEARNER").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        badRequest(put(PUB + "/" + id + "/mark"), Map.of(), "ROLE_LEARNER");
        call(put(PUB + "/" + id + "/mark"), Map.of("reviewed", false), "ROLE_LEARNER").andExpect(status().isOk());
    }

    @Test
    void mapsServiceErrors() throws Exception {
        when(moderator.review(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.INTERVIEW_REVIEW_STALE));
        call(patch(MOD + "/" + id + "/review"), Map.of("decision", "APPROVE", "reviewToken", TOKEN), "ROLE_MODERATOR")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_REVIEW_STALE"));
        when(moderator.publication(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.INTERVIEW_STATE_INVALID));
        call(patch(MOD + "/" + id + "/publication"), Map.of("action", "RESTORE", "reviewToken", TOKEN), "ROLE_MODERATOR")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_STATE_INVALID"));
        when(moderator.detail(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.INTERVIEW_AUTHOR_INELIGIBLE));
        get(MOD + "/" + id, "ROLE_MODERATOR").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INTERVIEW_AUTHOR_INELIGIBLE"));
        when(practice.answer(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND));
        get(PUB + "/" + id + "/answer", "ROLE_LEARNER").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INTERVIEW_QUESTION_NOT_FOUND"));
        when(practice.mark(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.ACCESS_DENIED));
        call(put(PUB + "/" + id + "/mark"), Map.of("saved", true), "ROLE_LEARNER").andExpect(status().isForbidden());
        when(practice.list(eq(actor), any())).thenThrow(new CustomException(ErrorCode.ACCESS_DENIED));
        get(PUB + "?mark=SAVED", "ROLE_LEARNER").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }
}
