package com.techverse.server.forum;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.ForumController;
import com.techverse.server.enums.ForumReactionType;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.ForumService;

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

/** HTTP-level rules of the forum controller: field bounds, null vs missing, login, error mapping. */
@WebMvcTest(ForumController.class)
@Import(ForumControllerTest.MethodSecurity.class)
class ForumControllerTest {
    static final String API = "/api/v1/forum";

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean ForumService service;

    final UUID actor = UUID.randomUUID();
    final UUID id = UUID.randomUUID();
    final String topic = UUID.randomUUID().toString();

    ResultActions call(MockHttpServletRequestBuilder req, Object body, boolean signedIn) throws Exception {
        req.with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body instanceof String s ? s : mapper.writeValueAsString(body));
        if (signedIn) req.with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority("ROLE_LEARNER")));
        return mvc.perform(req);
    }

    void badRequest(MockHttpServletRequestBuilder req, Object body) throws Exception {
        call(req, body, true).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    static Map<String, Object> map(Object... kv) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    @Test
    void questionBodiesAreBoundedAfterTrim() throws Exception {
        String body20 = "x".repeat(20);
        for (var bad : List.of(
                map("content", body20, "topicId", topic),
                map("title", "  " + "t".repeat(9) + "  ", "content", body20, "topicId", topic),
                map("title", "t".repeat(151), "content", body20, "topicId", topic),
                map("title", "t".repeat(10), "content", " " + "x".repeat(19) + " ", "topicId", topic),
                map("title", "t".repeat(10), "content", "x".repeat(10001), "topicId", topic),
                map("title", "t".repeat(10), "content", body20),
                map("title", "t".repeat(10), "content", body20, "topicId", "abc")))
            badRequest(post(API + "/questions"), bad);
        call(post(API + "/questions"), map("title", "t".repeat(150), "content", "x".repeat(10000), "topicId", topic), true).andExpect(status().isOk());
        call(post(API + "/questions"), map("title", "t".repeat(10), "content", body20, "topicId", topic), true).andExpect(status().isOk());
    }

    @Test
    void patchKeepsOmittedFieldsButRefusesNull() throws Exception {
        for (var bad : List.of(map("title", null), map("content", null), map("topicId", null), map("title", "short"), map("topicId", "abc")))
            badRequest(patch(API + "/questions/" + id), bad);
        call(patch(API + "/questions/" + id), map("title", "A valid new title"), true).andExpect(status().isOk());
        call(patch(API + "/questions/" + id), map(), true).andExpect(status().isOk());
    }

    @Test
    void answerBodiesAndAcceptedAnswer() throws Exception {
        for (var bad : List.of(map(), map("content", null), map("content", "x".repeat(9)), map("content", "x".repeat(10001))))
            badRequest(post(API + "/questions/" + id + "/answers"), bad);
        badRequest(patch(API + "/answers/" + id), map("content", "  short  "));
        call(post(API + "/questions/" + id + "/answers"), map("content", "x".repeat(10)), true).andExpect(status().isOk());

        // Missing answerId or a bad UUID is a field error; an explicit null clears the choice.
        badRequest(put(API + "/questions/" + id + "/accepted-answer"), map());
        badRequest(put(API + "/questions/" + id + "/accepted-answer"), map("answerId", "abc"));
        call(put(API + "/questions/" + id + "/accepted-answer"), map("answerId", null), true).andExpect(status().isOk());
        verify(service).accept(eq(actor), eq(id), isNull());
        UUID answer = UUID.randomUUID();
        call(put(API + "/questions/" + id + "/accepted-answer"), map("answerId", answer.toString()), true).andExpect(status().isOk());
        verify(service).accept(actor, id, answer);
    }

    @Test
    void pathIdsAndFiltersAreValidated() throws Exception {
        badRequest(patch(API + "/questions/abc"), map("title", "A valid new title"));
        badRequest(delete(API + "/answers/abc"), map());
        // Signed in only because @WebMvcTest lacks SecurityConfiguration; guest reads are in the integration test.
        for (String q : List.of("page=-1", "size=0", "size=51", "topicId=abc", "solved=maybe", "mine=maybe", "keyword=x", "keyword=" + "x".repeat(101)))
            badRequest(get(API + "/questions?" + q), null);
        call(get(API + "/questions?keyword=%20%20&size=50"), null, true).andExpect(status().isOk());
    }

    @Test
    void reactionBodiesAndFilters() throws Exception {
        String path = API + "/posts/" + id + "/reaction";
        // Missing, null and unknown types are field errors, not JSON errors.
        for (var bad : List.of(map(), map("type", null), map("type", "WOW"), map("type", "like"), map("type", "")))
            badRequest(put(path), bad);
        call(put(path), "{", true).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
        badRequest(put(API + "/posts/abc/reaction"), map("type", "LIKE"));
        badRequest(delete(API + "/posts/abc/reaction"), map());
        call(put(path), map("type", "LOVE"), true).andExpect(status().isOk());
        verify(service).react(actor, id, ForumReactionType.LOVE);
        call(delete(path), map(), true).andExpect(status().isOk());
        verify(service).unreact(actor, id);

        for (String q : List.of("type=WOW", "type=like", "page=-1", "size=0", "size=51"))
            badRequest(get(API + "/posts/" + id + "/reactions?" + q), null);
        badRequest(get(API + "/posts/abc/reactions"), null);
        call(get(API + "/posts/" + id + "/reactions?type=&size=50"), null, true).andExpect(status().isOk());
        verify(service).reactions(id, null, 0, 50);
        call(get(API + "/posts/" + id + "/reactions?type=HAHA&page=2"), null, true).andExpect(status().isOk());
        verify(service).reactions(id, ForumReactionType.HAHA, 2, 20);
    }

    @Test
    void writesNeedLogin() throws Exception {
        // @WebMvcTest has no SecurityConfiguration: body codes come from the integration test.
        call(post(API + "/questions"), map("title", "t".repeat(10), "content", "x".repeat(20), "topicId", topic), false)
                .andExpect(status().isUnauthorized());
        call(delete(API + "/answers/" + id), map(), false).andExpect(status().isUnauthorized());
        call(put(API + "/questions/" + id + "/accepted-answer"), map("answerId", null), false).andExpect(status().isUnauthorized());
        call(put(API + "/posts/" + id + "/reaction"), map("type", "LIKE"), false).andExpect(status().isUnauthorized());
        call(delete(API + "/posts/" + id + "/reaction"), map(), false).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void mapsServiceErrors() throws Exception {
        when(service.createAnswer(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.FORUM_ANSWER_LIMIT));
        call(post(API + "/questions/" + id + "/answers"), map("content", "x".repeat(10)), true).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FORUM_ANSWER_LIMIT"));
        when(service.updateAnswer(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.FORUM_POST_NOT_FOUND));
        call(patch(API + "/answers/" + id), map("content", "x".repeat(10)), true).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FORUM_POST_NOT_FOUND"));
        doThrow(new CustomException(ErrorCode.FORUM_RATE_LIMITED)).when(service).createQuestion(eq(actor), any());
        call(post(API + "/questions"), map("title", "t".repeat(10), "content", "x".repeat(20), "topicId", topic), true)
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("FORUM_RATE_LIMITED"));
        when(service.updateQuestion(eq(actor), eq(id), any())).thenThrow(new CustomException(ErrorCode.FORUM_CONTENT_INVALID));
        call(patch(API + "/questions/" + id), map("content", "x".repeat(20)), true).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("FORUM_CONTENT_INVALID"));
        when(service.react(actor, id, ForumReactionType.LIKE)).thenThrow(new CustomException(ErrorCode.FORUM_QUESTION_CLOSED));
        call(put(API + "/posts/" + id + "/reaction"), map("type", "LIKE"), true).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FORUM_QUESTION_CLOSED"));
    }
}
