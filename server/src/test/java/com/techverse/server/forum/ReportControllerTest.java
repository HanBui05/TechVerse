package com.techverse.server.forum;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.ModeratorReportController;
import com.techverse.server.controller.ReportController;
import com.techverse.server.exception.*;
import com.techverse.server.service.impl.ReportService;

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

/** HTTP-level rules of the report and moderator report controllers: field bounds, notes by action, roles, error mapping. */
@WebMvcTest({ReportController.class, ModeratorReportController.class})
@Import(ReportControllerTest.MethodSecurity.class)
class ReportControllerTest {
    static final String MOD = "/api/v1/moderator";

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean ReportService service;

    final UUID actor = UUID.randomUUID();
    final String id = UUID.randomUUID().toString();

    ResultActions call(MockHttpServletRequestBuilder req, Object body, String role) throws Exception {
        req.with(csrf());
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        if (role != null) req.with(jwt().jwt(j -> j.subject(actor.toString())).authorities(new SimpleGrantedAuthority("ROLE_" + role)));
        return mvc.perform(req);
    }

    void badRequest(MockHttpServletRequestBuilder req, Object body, String role) throws Exception {
        call(req, body, role).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    static Map<String, Object> map(Object... kv) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    Map<String, Object> report(String reason, Object description) {
        return map("targetType", "FORUM_POST", "targetId", id, "reason", reason, "description", description);
    }

    @Test
    void reportBodiesAreValidated() throws Exception {
        for (var bad : List.of(
                map("targetType", "ARTICLE", "targetId", id, "reason", "SPAM"),
                map("targetId", id, "reason", "SPAM"),
                map("targetType", "FORUM_POST", "targetId", "abc", "reason", "SPAM"),
                map("targetType", "FORUM_POST", "reason", "SPAM"),
                map("targetType", "FORUM_POST", "targetId", id, "reason", "RUDE"),
                map("targetType", "FORUM_POST", "targetId", id),
                report("OTHER", null),
                report("OTHER", "  too short "),
                report("SPAM", "x".repeat(1001)),
                report("SPAM", "bad\u0000char")))
            badRequest(post("/api/v1/reports"), bad, "LEARNER");
        call(post("/api/v1/reports"), report("OTHER", "x".repeat(10)), "LEARNER").andExpect(status().isOk());
        call(post("/api/v1/reports"), report("SPAM", "   "), "LEARNER").andExpect(status().isOk());
        verify(service).create(eq(actor), argThat(r -> r.description() == null));
        call(post("/api/v1/reports"), report("SPAM", null), null).andExpect(status().isUnauthorized());
    }

    @Test
    void moderatorNotesDependOnTheAction() throws Exception {
        for (var bad : List.of(map("action", "HIDE_CONTENT"), map("action", "HIDE_CONTENT", "note", "  "), map("action", "HIDE"),
                map("note", "x"), map("action", "HIDE_CONTENT", "note", "x".repeat(1001)), map("action", "DISMISS", "note", "x".repeat(1001))))
            badRequest(patch(MOD + "/reports/" + id + "/resolve"), bad, "MODERATOR");
        for (var bad : List.of(map("action", "HIDE"), map("action", "HIDE", "note", " "), map("action", "HIDE_CONTENT", "note", "x"),
                map("action", "RESTORE", "note", "x".repeat(1001))))
            badRequest(patch(MOD + "/forum/posts/" + id + "/visibility"), bad, "MODERATOR");
        badRequest(patch(MOD + "/reports/abc/resolve"), map("action", "DISMISS"), "MODERATOR");

        call(patch(MOD + "/reports/" + id + "/resolve"), map("action", "DISMISS"), "MODERATOR").andExpect(status().isOk());
        call(patch(MOD + "/reports/" + id + "/resolve"), map("action", "HIDE_CONTENT", "note", "x".repeat(1000)), "MODERATOR").andExpect(status().isOk());
        call(patch(MOD + "/forum/posts/" + id + "/visibility"), map("action", "RESTORE"), "MODERATOR").andExpect(status().isOk());
        call(patch(MOD + "/forum/posts/" + id + "/visibility"), map("action", "HIDE", "note", "Off-topic"), "MODERATOR").andExpect(status().isOk());
    }

    @Test
    void moderatorFiltersAndRoles() throws Exception {
        for (String q : List.of("status=", "status=CLOSED", "reason=RUDE", "page=-1", "size=0", "size=51"))
            badRequest(get(MOD + "/reports?" + q), null, "MODERATOR");
        for (String q : List.of("status=", "status=VISIBLE", "page=-1", "size=51"))
            badRequest(get(MOD + "/forum/posts?" + q), null, "MODERATOR");
        call(get(MOD + "/reports?status=DISMISSED&reason=SPAM&size=50"), null, "MODERATOR").andExpect(status().isOk());
        call(get(MOD + "/forum/posts?status=HIDDEN"), null, "MODERATOR").andExpect(status().isOk());

        call(get(MOD + "/reports"), null, "ADMIN").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        call(patch(MOD + "/forum/posts/" + id + "/visibility"), map("action", "RESTORE"), "LEARNER").andExpect(status().isForbidden());
        call(get(MOD + "/reports"), null, null).andExpect(status().isUnauthorized());
    }

    @Test
    void mapsServiceErrors() throws Exception {
        for (var code : List.of(ErrorCode.REPORT_TARGET_NOT_FOUND, ErrorCode.REPORT_OWN_CONTENT, ErrorCode.REPORT_ALREADY_SUBMITTED,
                ErrorCode.FORUM_RATE_LIMITED, ErrorCode.FORUM_STORAGE_UNAVAILABLE)) {
            when(service.create(eq(actor), any())).thenThrow(new CustomException(code));
            call(post("/api/v1/reports"), report("SPAM", null), "LEARNER").andExpect(status().is(code.getStatus().value()))
                    .andExpect(jsonPath("$.code").value(code.getCode()));
        }
        for (var code : List.of(ErrorCode.REPORT_NOT_FOUND, ErrorCode.REPORT_ALREADY_HANDLED, ErrorCode.ACCESS_DENIED)) {
            when(service.resolve(eq(actor), any(), any())).thenThrow(new CustomException(code));
            call(patch(MOD + "/reports/" + id + "/resolve"), map("action", "DISMISS"), "MODERATOR")
                    .andExpect(status().is(code.getStatus().value())).andExpect(jsonPath("$.code").value(code.getCode()));
        }
        for (var code : List.of(ErrorCode.FORUM_POST_NOT_FOUND, ErrorCode.FORUM_STATE_INVALID)) {
            when(service.visibility(eq(actor), any(), any())).thenThrow(new CustomException(code));
            call(patch(MOD + "/forum/posts/" + id + "/visibility"), map("action", "RESTORE"), "MODERATOR")
                    .andExpect(status().is(code.getStatus().value())).andExpect(jsonPath("$.code").value(code.getCode()));
        }
    }
}
