package com.techverse.server.messaging;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.ModeratorConversationController;
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

import java.util.*;

/** HTTP-level rules of the moderator conversation controller: filters, lock notes, roles, error mapping. */
@WebMvcTest(ModeratorConversationController.class)
@Import(ModeratorConversationControllerTest.MethodSecurity.class)
class ModeratorConversationControllerTest {
    static final String API = "/api/v1/moderator/conversations";

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean ConversationService service;

    final UUID actor = UUID.randomUUID();
    final UUID id = UUID.randomUUID();

    ResultActions call(MockHttpServletRequestBuilder req, Object body, String role) throws Exception {
        req.with(csrf());
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        if (role != null) req.with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority("ROLE_" + role)));
        return mvc.perform(req);
    }

    void badRequest(MockHttpServletRequestBuilder req, Object body) throws Exception {
        call(req, body, "MODERATOR").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    static Map<String, Object> map(Object... kv) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    @Test
    void lockedListNeedsLockedTrueAndBoundedPages() throws Exception {
        for (String q : List.of("", "?locked=false", "?locked=", "?locked=true&page=-1", "?locked=true&size=0", "?locked=true&size=51"))
            badRequest(get(API + q), null);
        call(get(API + "?locked=true&page=1&size=50"), null, "MODERATOR").andExpect(status().isOk());
        verify(service).locked(actor, 1, 50);
    }

    @Test
    void messagesArePagedLikeTheParticipantsApi() throws Exception {
        for (String q : List.of("size=0", "size=51", "beforeSeq=-1", "beforeSeq=5&afterSeq=1")) badRequest(get(API + "/" + id + "/messages?" + q), null);
        badRequest(get(API + "/abc/messages"), null);
        call(get(API + "/" + id + "/messages?afterSeq=0&size=10"), null, "MODERATOR").andExpect(status().isOk());
        verify(service).moderatorMessages(actor, id, null, 0L, 10);
    }

    @Test
    void lockingNeedsANoteButUnlockingDoesNot() throws Exception {
        for (var bad : List.of(map(), map("note", "x"), map("locked", true), map("locked", true, "note", "  "),
                map("locked", true, "note", "x".repeat(1001)), map("locked", false, "note", "x".repeat(1001)), map("locked", true, "note", "a\u0000b")))
            badRequest(patch(API + "/" + id + "/lock"), bad);
        call(patch(API + "/" + id + "/lock"), map("locked", true, "note", " " + "x".repeat(1000) + " "), "MODERATOR").andExpect(status().isOk());
        verify(service).lock(actor, id, true, "x".repeat(1000));
        call(patch(API + "/" + id + "/lock"), map("locked", false), "MODERATOR").andExpect(status().isOk());
        verify(service).lock(actor, id, false, null);
    }

    @Test
    void onlyModeratorsGetIn() throws Exception {
        for (String role : List.of("ADMIN", "LEARNER", "AUTHOR")) {
            call(get(API + "?locked=true"), null, role).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            call(get(API + "/" + id + "/messages"), null, role).andExpect(status().isForbidden());
            call(patch(API + "/" + id + "/lock"), map("locked", false), role).andExpect(status().isForbidden());
        }
        call(get(API + "/" + id + "/messages"), null, null).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void mapsServiceErrors() throws Exception {
        for (var code : List.of(ErrorCode.CONVERSATION_NOT_FOUND, ErrorCode.CONVERSATION_STATE_INVALID, ErrorCode.ACCESS_DENIED)) {
            when(service.lock(eq(actor), any(), anyBoolean(), any())).thenThrow(new CustomException(code));
            call(patch(API + "/" + id + "/lock"), map("locked", false), "MODERATOR").andExpect(status().is(code.getStatus().value()))
                    .andExpect(jsonPath("$.code").value(code.getCode()));
        }
        when(service.moderatorMessages(eq(actor), any(), any(), any(), anyInt())).thenThrow(new CustomException(ErrorCode.CONVERSATION_NOT_FOUND));
        call(get(API + "/" + id + "/messages"), null, "MODERATOR").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
    }
}
