package com.techverse.server.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import java.util.*;

/** Blocking, reporting and the moderator's read and lock gate, against a real database and security chain. */
class ConversationModerationIntegrationTest extends ConversationIntegrationTestBase {
    static final String MOD = "/api/v1/moderator";
    static final String SECRET = "Private words only the two of us see";

    // ------------------------------------------------------------------ (1) blocking

    @Test
    void blockStopsBothSidesAndOnlyTheBlockerUnblocks() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        String clientId = UUID.randomUUID().toString();
        send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Before", "clientId", clientId)).andExpect(status().isCreated());

        var blocked = data(block(id, authorToken, true).andExpect(status().isOk()));
        assertThat(blocked.path("blockedByMe").asBoolean()).isTrue();
        assertThat(blocked.path("canSend").asBoolean()).isFalse();
        block(id, authorToken, true).andExpect(status().isOk());
        var seen = data(get(API + "/" + id, learnerToken));
        assertThat(seen.path("blockedByOther").asBoolean()).isTrue();
        assertThat(seen.path("canSend").asBoolean()).isFalse();

        message(id, learnerToken, "After").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_BLOCKED"));
        message(id, authorToken, "After").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_BLOCKED"));
        // A retry of a message stored before the block still answers with that message.
        send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Before", "clientId", clientId)).andExpect(status().isOk());
        for (boolean value : List.of(true, false))
            block(id, learnerToken, value).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_BLOCKED"));
        block(id, thirdToken, true).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
        for (String token : List.of(modToken, adminToken))
            block(UUID.randomUUID().toString(), token, true).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        send(put(API + "/" + id + "/block"), learnerToken, Map.of()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        assertThat(data(block(id, authorToken, false).andExpect(status().isOk())).path("canSend").asBoolean()).isTrue();
        block(id, authorToken, false).andExpect(status().isOk());
        message(id, authorToken, "Back").andExpect(status().isCreated());
        message(id, learnerToken, "Back too").andExpect(status().isCreated());
    }

    // ------------------------------------------------------------------ (2) reporting

    @Test
    void participantsReportOnceAndOnlyWhenTheOtherSideWrote() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        message(id, learnerToken, SECRET).andExpect(status().isCreated());

        report(id, learnerToken).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REPORT_TARGET_EMPTY"));
        report(id, authorToken).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("OPEN"));
        report(id, authorToken).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REPORT_ALREADY_SUBMITTED"));
        report(id, thirdToken).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("REPORT_TARGET_NOT_FOUND"));
        report(UUID.randomUUID().toString(), learnerToken).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_TARGET_NOT_FOUND"));
        for (String token : List.of(modToken, adminToken, multiToken))
            report(id, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.reports WHERE target_type='CONVERSATION'", Integer.class)).isEqualTo(1);
    }

    // ------------------------------------------------------------------ (3) privacy

    @Test
    void moderatorsReadOnlyReportedConversationsAndListsCarryNoContent() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        message(id, learnerToken, SECRET).andExpect(status().isCreated());

        get(MOD + "/conversations/" + id + "/messages", modToken).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
        lock(id, modToken, true, "No").andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
        get(MOD + "/conversations/" + UUID.randomUUID() + "/messages", modToken).andExpect(status().isNotFound());

        report(id, authorToken).andExpect(status().isOk());
        var read = data(get(MOD + "/conversations/" + id + "/messages", modToken).andExpect(status().isOk()));
        assertThat(contents(read)).containsExactly(SECRET);
        assertThat(read.at("/messages/0/senderId").asText()).isEqualTo(learner.toString());
        // Reading as a moderator moves nobody's read marker.
        assertThat(unread(authorToken)).isEqualTo(1);

        for (String token : List.of(adminToken, learnerToken)) {
            get(MOD + "/conversations/" + id + "/messages", token).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
            get(MOD + "/conversations?locked=true", token).andExpect(status().isForbidden());
        }
        get(MOD + "/conversations/" + id + "/messages", null).andExpect(status().isUnauthorized());

        // The default queue stays forum-only, so the current moderator page never meets a conversation item.
        assertThat(data(get(MOD + "/reports", modToken).andExpect(status().isOk())).path("content")).isEmpty();
        var queue = get(MOD + "/reports?targetType=CONVERSATION", modToken).andExpect(status().isOk());
        var item = data(queue).path("content").get(0);
        assertThat(item.path("targetType").asText()).isEqualTo("CONVERSATION");
        assertThat(item.at("/conversation/id").asText()).isEqualTo(id);
        assertThat(item.at("/conversation/learner/id").asText()).isEqualTo(learner.toString());
        assertThat(item.at("/conversation/author/id").asText()).isEqualTo(author.toString());
        assertThat(item.at("/conversation/locked").asBoolean()).isFalse();
        assertThat(item.path("post").isNull()).isTrue();
        assertThat(queue.andReturn().getResponse().getContentAsString()).doesNotContain(SECRET);

        lock(id, modToken, true, "Harassment").andExpect(status().isOk());
        var locked = get(MOD + "/conversations?locked=true", modToken).andExpect(status().isOk());
        assertThat(data(locked).at("/content/0/id").asText()).isEqualTo(id);
        assertThat(locked.andReturn().getResponse().getContentAsString()).doesNotContain(SECRET);
        get(MOD + "/conversations", modToken).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        get(MOD + "/conversations?locked=false", modToken).andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ (4) locking

    @Test
    void lockingClosesOpenReportsStopsSendingAndUnlockingReopens() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        message(id, learnerToken, "Hi").andExpect(status().isCreated());
        message(id, authorToken, "Hello").andExpect(status().isCreated());
        String first = data(report(id, learnerToken)).path("id").asText();
        String second = data(report(id, authorToken)).path("id").asText();

        resolve(first, modToken, "HIDE_CONTENT", "Wrong").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        resolve(first, modToken, "LOCK_CONVERSATION", null).andExpect(status().isBadRequest());
        // Two moderators at once: one locks, the other finds the report handled.
        assertThat(race(List.of(modToken, mod2()), t -> resolve(first, t, "LOCK_CONVERSATION", "Abuse")))
                .containsExactlyInAnyOrder("200:", "409:REPORT_ALREADY_HANDLED");
        assertThat(jdbc.queryForList("SELECT status FROM techverse.reports WHERE id IN (?::uuid,?::uuid)", String.class, first, second))
                .containsOnly("ACTIONED");
        resolve(second, modToken, "DISMISS", null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REPORT_ALREADY_HANDLED"));

        var seen = data(get(API + "/" + id, learnerToken));
        assertThat(seen.path("locked").asBoolean()).isTrue();
        assertThat(seen.path("canSend").asBoolean()).isFalse();
        for (String token : List.of(learnerToken, authorToken))
            message(id, token, "Still here?").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_LOCKED"));
        jdbc.update("DELETE FROM techverse.reports WHERE id=?::uuid", second);
        report(id, authorToken).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_LOCKED"));
        lock(id, modToken, true, "Again").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_STATE_INVALID"));
        var listed = data(get(MOD + "/conversations?locked=true", modToken)).path("content").get(0);
        assertThat(listed.path("lockNote").asText()).isEqualTo("Abuse");
        assertThat(listed.path("lockedBy").isObject()).isTrue();

        lock(id, modToken, false, null).andExpect(status().isOk()).andExpect(jsonPath("$.data.locked").value(false));
        lock(id, modToken, false, null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_STATE_INVALID"));
        assertThat(data(get(MOD + "/conversations?locked=true", modToken)).path("content")).isEmpty();
        message(id, learnerToken, "Thanks").andExpect(status().isCreated());

        // A direct lock also closes the open reports.
        String third = data(report(id, authorToken).andExpect(status().isOk())).path("id").asText();
        lock(id, modToken, true, "Direct").andExpect(status().isOk()).andExpect(jsonPath("$.data.locked").value(true));
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.reports WHERE id=?::uuid", String.class, third)).isEqualTo("ACTIONED");
    }

    // ------------------------------------------------------------------ helpers

    String mod2() throws Exception {
        user("mod2@example.com", "MODERATOR");
        return login("mod2@example.com");
    }

    ResultActions block(String id, String token, boolean blocked) throws Exception {
        return send(put(API + "/" + id + "/block"), token, Map.of("blocked", blocked));
    }

    ResultActions report(String id, String token) throws Exception {
        return send(post("/api/v1/reports"), token, Map.of("targetType", "CONVERSATION", "targetId", id, "reason", "SPAM"));
    }

    ResultActions lock(String id, String token, boolean locked, String note) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("locked", locked);
        body.put("note", note);
        return send(patch(MOD + "/conversations/" + id + "/lock"), token, body);
    }

    ResultActions resolve(String report, String token, String action, String note) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("action", action);
        body.put("note", note);
        return send(patch(MOD + "/reports/" + report + "/resolve"), token, body);
    }
}
