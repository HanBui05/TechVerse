package com.techverse.server.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.controller.DashboardController;
import com.techverse.server.dto.response.DashboardResponse.*;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.service.impl.DashboardService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.*;

/** HTTP rules of the dashboard endpoints: roles, error mapping and the exact JSON shape. */
@WebMvcTest(DashboardController.class)
@Import(DashboardControllerTest.MethodSecurity.class)
class DashboardControllerTest {
    static final String ADMIN = "/api/v1/admin/dashboard";
    static final String MOD = "/api/v1/moderator/dashboard";

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean DashboardService service;

    final UUID actor = UUID.randomUUID();

    ResultActions call(String path, String... roles) throws Exception {
        var req = get(path);
        if (roles.length > 0)
            req.with(jwt().jwt(j -> j.subject(actor.toString()))
                    .authorities(Arrays.stream(roles).map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toArray(SimpleGrantedAuthority[]::new)));
        return mvc.perform(req);
    }

    @Test
    void theModeratorShapeIsExactlyTheTwoGroups() throws Exception {
        when(service.moderator(actor)).thenReturn(new Moderator(new Pending(1, 2, 3, 4), new Reports(5, 6)));
        var body = mapper.readTree(call(MOD + "?revenue=true", "MODERATOR").andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).path("data");
        assertThat(body.toString()).isEqualTo("{\"pending\":{\"articles\":1,\"courses\":2,\"exerciseSets\":3,"
                + "\"interviewQuestions\":4},\"reports\":{\"open\":5,\"hiddenPosts\":6}}");
    }

    @Test
    void theAdminShapeHasNoNulls() throws Exception {
        var period = new Period(1, 100_000, 20_000, 80_000);
        when(service.admin(actor)).thenReturn(new Admin(new Users(4, 3, 1, 2), new Authors(1, 0, 0),
                new Content(1, 1, 0, 0, 0), new Orders(0, 0), new Revenue(period, period)));
        var body = mapper.readTree(call(ADMIN + "?from=2026-01-01", "ADMIN").andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).path("data");
        assertThat(fieldNames(body)).containsExactly("users", "authors", "content", "orders", "revenue");
        assertNoNulls(body);
        assertThat(body.at("/revenue/last30Days/authorAmount").asLong()).isEqualTo(80_000);
    }

    @Test
    void rolesAndErrorsAreMapped() throws Exception {
        call(ADMIN).andExpect(status().isUnauthorized());
        call(MOD).andExpect(status().isUnauthorized());
        call(ADMIN, "MODERATOR").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        call(MOD, "ADMIN").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        verifyNoInteractions(service);

        when(service.admin(any())).thenThrow(new CustomException(ErrorCode.ACCESS_DENIED));
        call(ADMIN, "ADMIN").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        when(service.moderator(any())).thenThrow(new IllegalStateException("too big"));
        call(MOD, "MODERATOR").andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
    }

    static List<String> fieldNames(JsonNode node) {
        var names = new ArrayList<String>();
        node.propertyNames().forEach(names::add);
        return names;
    }

    static void assertNoNulls(JsonNode node) {
        assertThat(node.isNull()).isFalse();
        node.forEach(DashboardControllerTest::assertNoNulls);
    }
}
