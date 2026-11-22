package com.techverse.server.messaging;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.ConversationController;
import com.techverse.server.dto.response.ConversationResponse;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.ConversationService;

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

import java.time.Instant;
import java.util.*;

/** HTTP-level rules of the conversation controller: field bounds, login, 201 vs 200, error mapping. */
@WebMvcTest(ConversationController.class)
@Import(ConversationControllerTest.MethodSecurity.class)
class ConversationControllerTest {
    static final String API = "/api/v1/conversations";

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean ConversationService service;

    final UUID actor = UUID.randomUUID();
    final UUID id = UUID.randomUUID();
    final String clientId = UUID.randomUUID().toString();

    ResultActions call(MockHttpServletRequestBuilder req, Object body, boolean signedIn) throws Exception {
        req.with(csrf());
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body instanceof String s ? s : mapper.writeValueAsString(body));
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

    ConversationService.Sent sent(boolean created) {
        return new ConversationService.Sent(new ConversationResponse.Message(UUID.randomUUID(), 1, actor, true, "x", Instant.now()), created);
    }

    @Test
    void openNeedsAUuidCourse() throws Exception {
        for (var bad : List.of(map(), map("courseId", null), map("courseId", "abc"), map("courseId", "")))
            badRequest(post(API), bad);
        UUID course = UUID.randomUUID();
        call(post(API), map("courseId", course.toString()), true).andExpect(status().isOk());
        verify(service).open(actor, course);
    }

    @Test
    void messageBodiesAreBoundedAfterTrimAndRepeatsAnswer200() throws Exception {
        String path = API + "/" + id + "/messages";
        for (var bad : List.of(map("clientId", clientId), map("content", null, "clientId", clientId), map("content", "   ", "clientId", clientId),
                map("content", "x".repeat(2001), "clientId", clientId), map("content", "Hi"), map("content", "Hi", "clientId", "abc")))
            badRequest(post(path), bad);
        badRequest(post(API + "/abc/messages"), map("content", "Hi", "clientId", clientId));

        when(service.send(eq(actor), eq(id), anyString(), any())).thenReturn(sent(true));
        call(post(path), map("content", " " + "x".repeat(2000) + " ", "clientId", clientId), true).andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value(201));
        verify(service).send(actor, id, "x".repeat(2000), UUID.fromString(clientId));
        when(service.send(eq(actor), eq(id), anyString(), any())).thenReturn(sent(false));
        call(post(path), map("content", "x", "clientId", clientId), true).andExpect(status().isOk());
    }

    @Test
    void cursorsSizesPagesAndReadMarkersAreValidated() throws Exception {
        for (String q : List.of("size=0", "size=51", "beforeSeq=-1", "afterSeq=-1", "beforeSeq=5&afterSeq=1", "beforeSeq=abc",
                "afterSeq=99999999999999999999"))
            badRequest(get(API + "/" + id + "/messages?" + q), null);
        call(get(API + "/" + id + "/messages?size=50&afterSeq=0"), null, true).andExpect(status().isOk());
        verify(service).messages(actor, id, null, 0L, 50);
        call(get(API + "/" + id + "/messages"), null, true).andExpect(status().isOk());
        verify(service).messages(actor, id, null, null, 30);
        call(get(API + "/" + id + "/messages?beforeSeq=" + Long.MAX_VALUE), null, true).andExpect(status().isOk());
        verify(service).messages(actor, id, Long.MAX_VALUE, null, 30);

        for (String q : List.of("page=-1", "size=0", "size=51")) badRequest(get(API + "?" + q), null);
        call(get(API + "?page=2&size=50"), null, true).andExpect(status().isOk());
        verify(service).list(actor, 2, 50);
        badRequest(get(API + "/abc"), null);

        for (var bad : List.of(map(), map("seq", null), map("seq", -1))) badRequest(put(API + "/" + id + "/read"), bad);
        call(put(API + "/" + id + "/read"), map("seq", Long.MAX_VALUE), true).andExpect(status().isOk());
        verify(service).markRead(actor, id, Long.MAX_VALUE);
        call(put(API + "/" + id + "/read"), map("seq", 0), true).andExpect(status().isOk());
    }

    @Test
    void blockNeedsABoolean() throws Exception {
        for (var bad : List.of(map(), map("blocked", null))) badRequest(put(API + "/" + id + "/block"), bad);
        badRequest(put(API + "/abc/block"), map("blocked", true));
        call(put(API + "/" + id + "/block"), map("blocked", false), true).andExpect(status().isOk());
        verify(service).block(actor, id, false);
        call(put(API + "/" + id + "/block"), map("blocked", true), false).andExpect(status().isUnauthorized());
        doThrow(new CustomException(ErrorCode.CONVERSATION_BLOCKED)).when(service).block(actor, id, true);
        call(put(API + "/" + id + "/block"), map("blocked", true), true).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONVERSATION_BLOCKED"));
    }

    @Test
    void everyRouteNeedsLogin() throws Exception {
        // @WebMvcTest has no SecurityConfiguration: body codes come from the integration test.
        call(post(API), map("courseId", UUID.randomUUID().toString()), false).andExpect(status().isUnauthorized());
        call(get(API), null, false).andExpect(status().isUnauthorized());
        call(get(API + "/unread-count"), null, false).andExpect(status().isUnauthorized());
        call(get(API + "/" + id), null, false).andExpect(status().isUnauthorized());
        call(get(API + "/" + id + "/messages"), null, false).andExpect(status().isUnauthorized());
        call(post(API + "/" + id + "/messages"), map("content", "Hi", "clientId", clientId), false).andExpect(status().isUnauthorized());
        call(put(API + "/" + id + "/read"), map("seq", 1), false).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void mapsServiceErrors() throws Exception {
        String path = API + "/" + id + "/messages";
        var body = map("content", "Hi", "clientId", clientId);
        var cases = Map.of(
                ErrorCode.CONVERSATION_AWAITING_REPLY, 409, ErrorCode.CONVERSATION_BLOCKED, 409, ErrorCode.CONVERSATION_LOCKED, 409,
                ErrorCode.MESSAGE_CLIENT_ID_CONFLICT, 409, ErrorCode.MESSAGE_CONTENT_INVALID, 400, ErrorCode.MESSAGE_RATE_LIMITED, 429,
                ErrorCode.MESSAGE_STORAGE_UNAVAILABLE, 503, ErrorCode.CONVERSATION_NOT_FOUND, 404, ErrorCode.ACCESS_DENIED, 403);
        for (var e : cases.entrySet()) {
            doThrow(new CustomException(e.getKey())).when(service).send(eq(actor), eq(id), anyString(), any());
            call(post(path), body, true).andExpect(status().is(e.getValue())).andExpect(jsonPath("$.code").value(e.getKey().name()));
        }
        when(service.open(eq(actor), any())).thenThrow(new CustomException(ErrorCode.CONVERSATION_NOT_ALLOWED));
        call(post(API), map("courseId", UUID.randomUUID().toString()), true).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CONVERSATION_NOT_ALLOWED"));
    }
}
