package com.techverse.server.forum;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import java.util.*;

/** Reports and moderation with DB and security: submitting, closing on delete, the queue, hide/restore and races. */
class ReportIntegrationTest extends ForumIntegrationTestBase {
    static final String REPORTS = "/api/v1/reports";
    static final String MOD = "/api/v1/moderator";

    @Test
    void reportQuestionsAndAnswers() throws Exception {
        String q = ask(askerToken, "Question that gets reported", "Body of a question people report.");
        String a = answer(helperToken, q, "Answer that gets reported.");

        report(thirdToken, q, "SPAM", null).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("OPEN"));
        report(helperToken, a, "SPAM", null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REPORT_OWN_CONTENT"));
        report(askerToken, a, "OTHER", "  Copied from a paid course.  ").andExpect(status().isOk());
        report(thirdToken, q, "MISLEADING", null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REPORT_ALREADY_SUBMITTED"));
        assertThat(jdbc.queryForObject("SELECT description FROM techverse.reports WHERE target_id=?::uuid", String.class, a))
                .isEqualTo("Copied from a paid course.");

        // canReport turns false once the viewer has reported the post.
        get(API + "/questions/" + q, thirdToken).andExpect(jsonPath("$.data.viewer.canReport").value(false));
        get(API + "/questions/" + q, helperToken).andExpect(jsonPath("$.data.viewer.canReport").value(true));
        get(API + "/questions/" + q, askerToken).andExpect(jsonPath("$.data.answers[0].viewer.canReport").value(false));
        get(API + "/questions/" + q, thirdToken).andExpect(jsonPath("$.data.answers[0].viewer.canReport").value(true));

        report(null, q, "SPAM", null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        report(thirdToken, UUID.randomUUID().toString(), "SPAM", null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_TARGET_NOT_FOUND"));

        // A hidden question and the answers under it are gone for reporters.
        jdbc.update("UPDATE techverse.forum_posts SET status='HIDDEN' WHERE id=?::uuid", q);
        report(helperToken, q, "SPAM", null).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("REPORT_TARGET_NOT_FOUND"));
        report(thirdToken, a, "SPAM", null).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("REPORT_TARGET_NOT_FOUND"));

        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", helper);
        report(helperToken, a, "SPAM", null).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void deletingAPostDismissesItsOpenReports() throws Exception {
        String q = ask(askerToken, "Question deleted after a report", "Body of a question that will be deleted.");
        String a = answer(helperToken, q, "Answer deleted after a report.");
        report(thirdToken, q, "SPAM", null).andExpect(status().isOk());
        report(thirdToken, a, "SPAM", null).andExpect(status().isOk());

        send(delete(API + "/answers/" + a), helperToken, null).andExpect(status().isOk());
        send(delete(API + "/questions/" + q), askerToken, null).andExpect(status().isOk());

        var rows = jdbc.queryForList("SELECT status, resolution_note, handled_by, handled_at FROM techverse.reports");
        assertThat(rows).hasSize(2).allSatisfy(r -> {
            assertThat(r.get("status")).isEqualTo("DISMISSED");
            assertThat(r.get("resolution_note")).isEqualTo("Người đăng đã xóa nội dung");
            assertThat(r.get("handled_by")).isNull();
            assertThat(r.get("handled_at")).isNotNull();
        });
    }

    @Test
    void parallelReportsAndReportVersusDelete() throws Exception {
        String q = ask(askerToken, "Question reported twice at once", "Body of a question reported in a race.");
        assertThat(race(List.of(thirdToken, thirdToken), t -> report(t, q, "SPAM", null)))
                .containsExactlyInAnyOrder("200:", "409:REPORT_ALREADY_SUBMITTED");

        String q2 = ask(askerToken, "Question deleted during a report", "Body of a question deleted in a race.");
        var codes = race(List.of(thirdToken, askerToken),
                t -> t.equals(askerToken) ? send(delete(API + "/questions/" + q2), t, null) : report(t, q2, "SPAM", null));
        assertThat(codes).contains("200:");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.reports WHERE target_id=?::uuid AND status='OPEN'", Integer.class, q2))
                .isZero();
    }

    @Test
    void hideContentClosesEveryOpenReportThenRestore() throws Exception {
        String q = ask(askerToken, "Question the moderator hides", "Body of a question that will be hidden.");
        String a = answer(askerToken, q, "Answer under the hidden question.");
        String first = id(report(thirdToken, q, "SPAM", null));
        report(helperToken, q, "INAPPROPRIATE", null).andExpect(status().isOk());
        report(helperToken, a, "SPAM", null).andExpect(status().isOk());

        var queue = data(get(MOD + "/reports", modToken).andExpect(status().isOk())).path("content");
        assertThat(queue).hasSize(3);
        var row = queue.get(0);
        assertThat(row.path("id").asText()).isEqualTo(first);
        assertThat(row.path("reporter").path("fullName").asText()).isEqualTo("User third@example.com");
        assertThat(row.path("otherOpenReports").asInt()).isEqualTo(1);
        assertThat(row.path("post").path("type").asText()).isEqualTo("QUESTION");
        assertThat(row.path("post").path("questionTitle").asText()).isEqualTo("Question the moderator hides");
        assertThat(row.path("post").path("publiclyVisible").asBoolean()).isTrue();
        var answerRow = queue.get(2).path("post");
        assertThat(answerRow.path("type").asText()).isEqualTo("ANSWER");
        assertThat(answerRow.path("questionId").asText()).isEqualTo(q);
        assertThat(answerRow.path("questionTitle").asText()).isEqualTo("Question the moderator hides");

        resolve(first, modToken, "HIDE_CONTENT", " ").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        resolve(first, modToken, "HIDE_CONTENT", "Spam links").andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("ACTIONED"))
                .andExpect(jsonPath("$.data.post.status").value("HIDDEN"));
        assertThat(jdbc.queryForList("SELECT status FROM techverse.reports WHERE target_id=?::uuid", String.class, q))
                .containsOnly("ACTIONED");
        resolve(first, modToken, "DISMISS", null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("REPORT_ALREADY_HANDLED"));
        resolve(UUID.randomUUID().toString(), modToken, "DISMISS", null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("REPORT_NOT_FOUND"));
        get(API + "/questions/" + q, null).andExpect(status().isNotFound());
        get(API + "/questions/" + q, askerToken).andExpect(status().isNotFound());

        // The answer report stays in the queue while its question is hidden.
        var open = data(get(MOD + "/reports", modToken)).path("content");
        assertThat(open).hasSize(1);
        assertThat(open.get(0).path("post").path("publiclyVisible").asBoolean()).isFalse();
        assertThat(data(get(MOD + "/reports?status=ACTIONED", modToken)).path("content")).hasSize(2);

        var hidden = data(get(MOD + "/forum/posts?status=HIDDEN", modToken).andExpect(status().isOk())).path("content");
        assertThat(hidden).hasSize(1);
        assertThat(hidden.get(0).path("id").asText()).isEqualTo(q);
        assertThat(hidden.get(0).path("moderationNote").asText()).isEqualTo("Spam links");
        assertThat(hidden.get(0).path("hiddenBy").path("fullName").asText()).isEqualTo("User mod@example.com");

        visibility(q, modToken, "RESTORE", null).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("VISIBLE"));
        get(API + "/questions/" + q, null).andExpect(status().isOk()).andExpect(jsonPath("$.data.answers[0].id").value(a));
        visibility(q, modToken, "RESTORE", null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FORUM_STATE_INVALID"));
        visibility(UUID.randomUUID().toString(), modToken, "HIDE", "Gone").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FORUM_POST_NOT_FOUND"));
    }

    @Test
    void dismissKeepsThePostAndHidingTheAcceptedAnswerUnsolves() throws Exception {
        String q = ask(askerToken, "Question with an accepted answer", "Body of a question that gets solved.");
        String a = answer(helperToken, q, "Accepted answer that gets hidden.");
        accept(q, askerToken, a).andExpect(status().isOk());
        String r = id(report(thirdToken, q, "MISLEADING", null));
        report(thirdToken, a, "SPAM", null).andExpect(status().isOk());

        resolve(r, modToken, "DISMISS", null).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DISMISSED"))
                .andExpect(jsonPath("$.data.post.status").value("VISIBLE"));
        assertThat(data(get(MOD + "/reports?status=DISMISSED", modToken)).path("content")).hasSize(1);

        visibility(a, modToken, "HIDE", null).andExpect(status().isBadRequest());
        visibility(a, modToken, "HIDE", "Hidden by the moderator").andExpect(status().isOk());
        get(API + "/questions/" + q, null).andExpect(jsonPath("$.data.solved").value(false)).andExpect(jsonPath("$.data.answers").isEmpty());
        assertThat(jdbc.queryForObject("SELECT status FROM techverse.reports WHERE target_id=?::uuid", String.class, a)).isEqualTo("ACTIONED");
        visibility(a, modToken, "HIDE", "Again").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FORUM_STATE_INVALID"));
        // Restoring makes the question solved again.
        visibility(a, modToken, "RESTORE", null).andExpect(status().isOk());
        get(API + "/questions/" + q, null).andExpect(jsonPath("$.data.solved").value(true));
    }

    @Test
    void racingModeratorsAndRoleChecks() throws Exception {
        user("mod2@example.com", "MODERATOR");
        String mod2Token = login("mod2@example.com");
        String q = ask(askerToken, "Question two moderators handle", "Body of a question handled twice.");
        String r = id(report(thirdToken, q, "SPAM", null));
        assertThat(race(List.of(modToken, mod2Token), t -> resolve(r, t, "HIDE_CONTENT", "Spam")))
                .containsExactlyInAnyOrder("200:", "409:REPORT_ALREADY_HANDLED");

        get(MOD + "/reports", adminToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        visibility(q, adminToken, "RESTORE", null).andExpect(status().isForbidden());
        get(MOD + "/reports", null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE email='mod2@example.com'");
        get(MOD + "/forum/posts", mod2Token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        visibility(q, mod2Token, "RESTORE", null).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ helpers

    ResultActions report(String token, String target, String reason, String description) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("targetType", "FORUM_POST");
        body.put("targetId", target);
        body.put("reason", reason);
        if (description != null) body.put("description", description);
        return send(post(REPORTS), token, body);
    }

    ResultActions resolve(String report, String token, String action, String note) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("action", action);
        body.put("note", note);
        return send(patch(MOD + "/reports/" + report + "/resolve"), token, body);
    }

    ResultActions visibility(String post, String token, String action, String note) throws Exception {
        var body = new HashMap<String, Object>();
        body.put("action", action);
        body.put("note", note);
        return send(patch(MOD + "/forum/posts/" + post + "/visibility"), token, body);
    }

    String id(ResultActions result) throws Exception {
        return data(result.andExpect(status().isOk())).path("id").asText();
    }
}
