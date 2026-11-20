package com.techverse.server.exercise;

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

/** HTTP-level rules of the moderator and learner exercise controllers (validation, roles, error mapping). */
@WebMvcTest({ModeratorExerciseController.class, PublishedExerciseController.class})
@Import(ExercisePracticeControllerTest.MethodSecurity.class)
class ExercisePracticeControllerTest {
    static final String MOD = "/api/v1/moderator/exercise-sets";
    static final String PUB = "/api/v1/exercise-sets";
    static final String TOKEN = "a".repeat(64);

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean ModeratorExerciseService moderator;
    @MockitoBean PublishedExerciseService practice;

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

    @Test
    void moderatorBodiesAreValidatedAndRolesEnforced() throws Exception {
        for (var bad : List.of(Map.of("decision", "APPROVE"), Map.of("reviewToken", TOKEN), Map.of("decision", "APPROVE", "reviewToken", "XYZ"), Map.of("decision", "APPROVE", "reviewToken", TOKEN, "note", "x".repeat(1001))))
            call(patch(MOD + "/" + id + "/review"), bad, "ROLE_MODERATOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        for (var bad : List.of(Map.of("action", "HIDE"), Map.of("reviewToken", TOKEN), Map.of("action", "HIDE", "reviewToken", TOKEN, "reason", "x".repeat(1001))))
            call(patch(MOD + "/" + id + "/publication"), bad, "ROLE_MODERATOR").andExpect(status().isBadRequest());
        call(patch(MOD + "/" + id + "/review"), Map.of("decision", "APPROVE", "reviewToken", TOKEN), "ROLE_ADMIN").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        // Unknown enum values are rejected as a malformed body (shared handler behaviour).
        call(patch(MOD + "/" + id + "/review"), Map.of("decision", "MAYBE", "reviewToken", TOKEN), "ROLE_MODERATOR").andExpect(status().isBadRequest());
        get(MOD, "ROLE_AUTHOR").andExpect(status().isForbidden());
        get(MOD, null).andExpect(status().isUnauthorized());
        for (String q : List.of("page=-1", "size=0", "size=51", "status=NOPE", "type=NOPE", "topicId=abc", "keyword=" + "x".repeat(101)))
            get(MOD + "?" + q, "ROLE_MODERATOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void mapsModeratorAndLearnerErrors() throws Exception {
        when(moderator.review(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.EXERCISE_REVIEW_STALE));
        call(patch(MOD + "/" + id + "/review"), Map.of("decision", "APPROVE", "reviewToken", TOKEN), "ROLE_MODERATOR")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EXERCISE_REVIEW_STALE"));
        when(practice.submit(eq(actor), eq(id), any(), any())).thenThrow(new CustomException(ErrorCode.EXERCISE_ATTEMPT_KEY_CONFLICT));
        call(post(PUB + "/" + id + "/attempts"), Map.of(), "ROLE_LEARNER").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_ATTEMPT_KEY_CONFLICT"));
        when(practice.questions(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.ACCESS_DENIED));
        get(PUB + "/" + id + "/questions", "ROLE_LEARNER").andExpect(status().isForbidden());
        when(practice.attempt(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.EXERCISE_ATTEMPT_NOT_FOUND));
        get("/api/v1/me/exercise-attempts/" + id, "ROLE_LEARNER").andExpect(status().isNotFound());
        when(practice.submit(eq(actor), eq(id), any(), any())).thenThrow(new CustomException(ErrorCode.EXERCISE_ATTEMPT_INVALID));
        call(post(PUB + "/" + id + "/attempts"), Map.of("durationSeconds", 5), "ROLE_LEARNER").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EXERCISE_ATTEMPT_INVALID"));
    }

    @Test
    void learnerRoutesNeedLoginAndFiltersAreValidated() throws Exception {
        get(PUB + "/" + id + "/questions", null).andExpect(status().isUnauthorized());
        call(post(PUB + "/" + id + "/attempts"), Map.of(), null).andExpect(status().isUnauthorized());
        get("/api/v1/me/exercise-attempts", null).andExpect(status().isUnauthorized());
        for (String q : List.of("page=-1", "size=0", "size=51", "difficulty=NOPE", "type=NOPE", "keyword=" + "x".repeat(101)))
            get(PUB + "?" + q, "ROLE_LEARNER").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        for (String q : List.of("page=-1", "size=51", "exerciseSetId=abc"))
            get("/api/v1/me/exercise-attempts?" + q, "ROLE_LEARNER").andExpect(status().isBadRequest());
    }
}
