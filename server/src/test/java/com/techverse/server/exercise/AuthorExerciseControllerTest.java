package com.techverse.server.exercise;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.AuthorExerciseController;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.AiRateLimitService.Quota;
import com.techverse.server.service.impl.AuthorExerciseService;
import com.techverse.server.service.impl.ExerciseAiService;

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

import tools.jackson.databind.ObjectMapper;

import java.util.*;

@WebMvcTest(AuthorExerciseController.class)
@Import(AuthorExerciseControllerTest.MethodSecurity.class)
class AuthorExerciseControllerTest {
    static final String ROOT = "/api/v1/author/exercise-sets";

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean AuthorExerciseService service;
    @MockitoBean ExerciseAiService ai;

    final UUID actor = UUID.randomUUID();
    final UUID id = UUID.randomUUID();

    ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, Object body, String role) throws Exception {
        return mvc.perform(req.with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority(role)))
                .with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content(body instanceof String s ? s : mapper.writeValueAsString(body)));
    }

    Map<String, Object> create(String key, Object value) {
        var b = new HashMap<String, Object>(Map.of("title", "Java basics", "topicId", UUID.randomUUID().toString(),
                "type", "MULTIPLE_CHOICE", "difficulty", "EASY"));
        if (value == null) b.remove(key);
        else b.put(key, value);
        return b;
    }

    @Test
    void createValidatesEveryMetadataField() throws Exception {
        for (var bad : List.of(create("title", "abcd"), create("title", "    abcd   "), create("title", "x".repeat(256)),
                create("description", "x".repeat(2001)), create("topicId", null), create("type", "CODE_BUG_FINDING"),
                create("type", "NOPE"), create("difficulty", "EXTREME"), create("difficulty", null)))
            call(post(ROOT), bad, "ROLE_AUTHOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void createReturns201() throws Exception {
        call(post(ROOT), create("title", "Java basics"), "ROLE_AUTHOR").andExpect(status().isCreated());
    }

    @Test
    void patchAndPutRequireAVersionAndRejectTypeChanges() throws Exception {
        call(patch(ROOT + "/" + id), Map.of("title", "Valid title"), "ROLE_AUTHOR").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        call(patch(ROOT + "/" + id), Map.of("version", -1), "ROLE_AUTHOR").andExpect(status().isBadRequest());
        call(patch(ROOT + "/" + id), Map.of("version", 0, "type", "FLASHCARD"), "ROLE_AUTHOR").andExpect(status().isBadRequest());
        call(put(ROOT + "/" + id + "/questions"), Map.of("questions", List.of()), "ROLE_AUTHOR").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        call(put(ROOT + "/" + id + "/questions"), Map.of("version", 0), "ROLE_AUTHOR").andExpect(status().isBadRequest());
        call(patch(ROOT + "/" + id), Map.of("version", 0, "title", "Valid title"), "ROLE_AUTHOR").andExpect(status().isOk());
    }

    @Test
    void listRejectsBadFilters() throws Exception {
        for (String q : List.of("page=-1", "size=0", "size=51", "status=NOPE", "type=NOPE", "keyword=" + "x".repeat(101)))
            mvc.perform(get(ROOT + "?" + q).with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority("ROLE_AUTHOR"))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void writesNeedTheAuthorRoleAndLoginIsRequired() throws Exception {
        call(post(ROOT), create("title", "Java basics"), "ROLE_LEARNER").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        mvc.perform(post(ROOT).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
    }

    @Test
    void aiQuestionsValidateTheBodyAndReturnQuotaHeaders() throws Exception {
        String url = ROOT + "/" + id + "/ai/questions";
        for (var bad : List.of(Map.of("version", 0, "instruction", "x"), Map.of("version", 0, "count", 0), Map.of("version", 0, "count", 11),
                Map.of("count", 3), Map.of("version", -1, "count", 3),
                Map.of("version", 0, "count", 3, "instruction", "x".repeat(501)), Map.of("version", 0, "count", 3, "sourceText", "x".repeat(8001))))
            call(post(url), bad, "ROLE_AUTHOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        call(post(url), Map.of("version", 0, "count", 3), "ROLE_LEARNER").andExpect(status().isForbidden());

        when(ai.suggest(eq(actor), eq(id), any()))
                .thenReturn(new ExerciseAiService.Result(new ExerciseAiService.Suggestions(List.of(), 3, 4), new Quota(10, 9)));
        call(post(url), Map.of("version", 0, "count", 3, "sourceText", "x".repeat(8000)), "ROLE_AUTHOR").andExpect(status().isOk())
                .andExpect(header().string("X-AI-Quota-Limit", "10")).andExpect(header().string("X-AI-Quota-Remaining", "9"))
                .andExpect(jsonPath("$.data.version").value(4));

        when(ai.suggest(eq(actor), eq(id), any()))
                .thenThrow(new com.techverse.server.service.AuthorAiService.QuotaAwareException(ErrorCode.AI_OUTPUT_INVALID, new Quota(10, 10)));
        call(post(url), Map.of("version", 0, "count", 3), "ROLE_AUTHOR").andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("AI_OUTPUT_INVALID")).andExpect(header().string("X-AI-Quota-Remaining", "10"));
    }

    @Test
    void mapsServiceErrorsAndFieldErrors() throws Exception {
        when(service.submit(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.EXERCISE_NOT_READY));
        call(post(ROOT + "/" + id + "/submit"), "{}", "ROLE_AUTHOR").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_NOT_READY"));
        when(service.replaceQuestions(eq(actor), eq(id), any()))
                .thenThrow(new CustomException(ErrorCode.EXERCISE_QUESTIONS_INVALID, Map.of("questions[0].content", "bad")));
        call(put(ROOT + "/" + id + "/questions"), Map.of("version", 0, "questions", List.of(Map.of())), "ROLE_AUTHOR")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EXERCISE_QUESTIONS_INVALID"))
                .andExpect(jsonPath("$.fieldErrors['questions[0].content']").value("bad"));
        when(service.copy(eq(actor), eq(id))).thenThrow(new CustomException(ErrorCode.EXERCISE_RATE_LIMITED));
        call(post(ROOT + "/" + id + "/copy"), "{}", "ROLE_AUTHOR").andExpect(status().isTooManyRequests());
        when(service.update(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.EXERCISE_VERSION_CONFLICT));
        call(patch(ROOT + "/" + id), Map.of("version", 3), "ROLE_AUTHOR").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EXERCISE_VERSION_CONFLICT"));
    }
}
