package com.techverse.server.forum;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.article.ArticleIntegrationTestBase;
import com.techverse.server.entity.User;
import com.techverse.server.repository.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.concurrent.*;

/** Forum Q&A with DB and security: guests, the ask–answer–accept flow, ownership, soft delete and races. */
class ForumIntegrationTest extends ForumIntegrationTestBase {
    @Test
    void guestsReadButMustLogInToWrite() throws Exception {
        String id = ask(askerToken, "How do JPA locks work?", "I need row locks in **Spring Data**.");
        get(API + "/questions", null).andExpect(status().isOk()).andExpect(jsonPath("$.data.content[0].id").value(id))
                .andExpect(jsonPath("$.data.content[0].author.fullName").value("User asker@example.com"))
                .andExpect(jsonPath("$.data.content[0].topic.name").value("Backend"))
                .andExpect(jsonPath("$.data.content[0].answerCount").value(0))
                .andExpect(jsonPath("$.data.content[0].solved").value(false));
        get(API + "/questions/" + id, null).andExpect(status().isOk()).andExpect(jsonPath("$.data.viewer.canAnswer").value(false))
                .andExpect(jsonPath("$.data.viewer.canReport").value(false));
        assertThat(data(get(API + "/options", null))).hasSize(2);

        send(post(API + "/questions"), null, question("Another question?", "Some long enough body", topic))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        send(post(API + "/questions/" + id + "/answers"), "not-a-token", Map.of("content", "An answer body"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_INVALID_ACCESS_TOKEN"));
        get(API + "/questions?mine=true", null).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        get(API + "/questions/" + UUID.randomUUID(), null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FORUM_POST_NOT_FOUND"));
    }

    @Test
    void askAnswerAcceptAndFilter() throws Exception {
        String q = ask(askerToken, "Why is 100% CPU_usage high?", "Trace shows **GC** pressure all the time.");
        String other = ask(helperToken, "Flexbox centering question", "How do I center a div with flexbox?", otherTopic);
        String a1 = answer(helperToken, q, "Check the heap size first.");
        String a2 = answer(thirdToken, q, "Profile allocations with JFR.");
        String mine = answer(askerToken, q, "Answering my own question here.");

        var detail = data(get(API + "/questions/" + q, askerToken));
        assertThat(detail.path("viewer").path("canAccept").asBoolean()).isTrue();
        assertThat(topIds(detail.path("answers"))).containsExactly(a1, a2, mine);

        accept(q, askerToken, a2).andExpect(status().isOk()).andExpect(jsonPath("$.data.solved").value(true))
                .andExpect(jsonPath("$.data.acceptedAnswerId").value(a2))
                .andExpect(jsonPath("$.data.answers[0].id").value(a2))
                .andExpect(jsonPath("$.data.answers[0].accepted").value(true));
        accept(q, askerToken, mine).andExpect(status().isOk()).andExpect(jsonPath("$.data.answers[0].id").value(mine));
        accept(q, helperToken, a1).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        accept(q, askerToken, other).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FORUM_ANSWER_INVALID"));

        assertThat(ids(get(API + "/questions?solved=true", null))).containsExactly(q);
        assertThat(ids(get(API + "/questions?solved=false", null))).containsExactly(other);
        assertThat(ids(get(API + "/questions?mine=true", helperToken))).containsExactly(other);
        assertThat(ids(get(API + "/questions?topicId=" + otherTopic, null))).containsExactly(other);
        assertThat(ids(get(API + "/questions?topicId=" + UUID.randomUUID(), null))).isEmpty();
        assertThat(ids(search("TRACE shows"))).containsExactly(q);
        assertThat(ids(search("100%"))).containsExactly(q);
        assertThat(ids(search("c_u"))).isEmpty();
        assertThat(ids(search("  "))).containsExactly(other, q);
        var row = data(get(API + "/questions?solved=true", null)).path("content").get(0);
        assertThat(row.path("answerCount").asInt()).isEqualTo(3);

        accept(q, askerToken, null).andExpect(status().isOk()).andExpect(jsonPath("$.data.solved").value(false));
        assertThat(ids(get(API + "/questions?solved=true", null))).isEmpty();

        // Editing keeps omitted fields and stamps editedAt; a deactivated topic blocks only a switch to it.
        send(patch(API + "/questions/" + q), askerToken, Map.of("title", "  Why is CPU usage so high?  ")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Why is CPU usage so high?"))
                .andExpect(jsonPath("$.data.content").value("Trace shows **GC** pressure all the time."))
                .andExpect(jsonPath("$.data.editedAt").isNotEmpty());
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id IN (?,?)", topic, otherTopic);
        send(patch(API + "/questions/" + q), askerToken, Map.of("topicId", otherTopic.toString())).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FORUM_TOPIC_INACTIVE"));
        send(patch(API + "/questions/" + q), askerToken, Map.of("topicId", topic.toString(), "content", "Still about GC pressure, edited."))
                .andExpect(status().isOk());
        send(post(API + "/questions"), askerToken, question("A fresh question title", "Body long enough to pass", topic))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("FORUM_TOPIC_INACTIVE"));
        send(patch(API + "/answers/" + a1), helperToken, Map.of("content", "Check the heap size and GC logs.")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.editedAt").isNotEmpty());
    }

    @Test
    void ownershipLockedAccountsAndStaff() throws Exception {
        String q = ask(askerToken, "Who may edit this question?", "Only the person who asked it.");
        String a = answer(helperToken, q, "Only the author can edit.");
        send(patch(API + "/questions/" + q), helperToken, Map.of("title", "Hijacked question title")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        send(delete(API + "/questions/" + q), modToken, null).andExpect(status().isForbidden());
        send(patch(API + "/answers/" + a), askerToken, Map.of("content", "Not my answer to edit")).andExpect(status().isForbidden());
        send(delete(API + "/answers/" + a), adminToken, null).andExpect(status().isForbidden());
        // Question and answer endpoints do not cross.
        send(patch(API + "/answers/" + q), askerToken, Map.of("content", "Wrong endpoint body")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FORUM_POST_NOT_FOUND"));
        send(delete(API + "/questions/" + a), helperToken, null).andExpect(status().isNotFound());

        // A locked account reads like a guest but writes nothing; its posts stay visible.
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", helper);
        get(API + "/questions/" + q, helperToken).andExpect(status().isOk()).andExpect(jsonPath("$.data.viewer.canAnswer").value(false))
                .andExpect(jsonPath("$.data.answers[0].viewer.canEdit").value(false));
        send(patch(API + "/answers/" + a), helperToken, Map.of("content", "Edited while locked")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        get(API + "/questions?mine=true", helperToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        // Staff ask and answer like everyone else.
        String staffQ = ask(adminToken, "Admin asks a question too", "Admins may post in the forum.");
        answer(modToken, staffQ, "Moderators may answer too.");
    }

    @Test
    void deletedQuestionStaysWhileAnswersRemain() throws Exception {
        String q = ask(askerToken, "Question that will be deleted", "Body that will be replaced by a deleted state.");
        String a = answer(helperToken, q, "The only answer here.");
        accept(q, askerToken, a).andExpect(status().isOk());
        send(delete(API + "/questions/" + q), askerToken, null).andExpect(status().isOk());

        get(API + "/questions/" + q, null).andExpect(status().isOk()).andExpect(jsonPath("$.data.deleted").value(true))
                .andExpect(jsonPath("$.data.title").doesNotExist()).andExpect(jsonPath("$.data.content").doesNotExist())
                .andExpect(jsonPath("$.data.author").doesNotExist()).andExpect(jsonPath("$.data.answers[0].id").value(a));
        assertThat(ids(get(API + "/questions", null))).isEmpty();
        send(post(API + "/questions/" + q + "/answers"), thirdToken, Map.of("content", "Late answer body")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FORUM_QUESTION_CLOSED"));
        send(patch(API + "/questions/" + q), askerToken, Map.of("title", "Edit after delete")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FORUM_QUESTION_CLOSED"));
        send(delete(API + "/questions/" + q), askerToken, null).andExpect(status().isNotFound());
        // The answer under it stays editable; deleting it closes the page.
        send(patch(API + "/answers/" + a), helperToken, Map.of("content", "Still editable here")).andExpect(status().isOk());
        send(delete(API + "/answers/" + a), helperToken, null).andExpect(status().isOk());
        get(API + "/questions/" + q, null).andExpect(status().isNotFound());

        // Deleting the accepted answer of a live question makes it unsolved.
        String q2 = ask(askerToken, "Second question, still live", "Its accepted answer will disappear.");
        String a2 = answer(helperToken, q2, "Accepted then deleted.");
        accept(q2, askerToken, a2).andExpect(status().isOk());
        send(delete(API + "/answers/" + a2), helperToken, null).andExpect(status().isOk());
        get(API + "/questions/" + q2, null).andExpect(jsonPath("$.data.solved").value(false)).andExpect(jsonPath("$.data.answers").isEmpty());
        send(delete(API + "/answers/" + a2), helperToken, null).andExpect(status().isNotFound());
    }

    @Test
    void parallelDuplicatesAndTheAnswerLimitHold() throws Exception {
        var body = question("Double click question", "Sent twice by a double click.", topic);
        assertThat(race(List.of(askerToken, askerToken), t -> send(post(API + "/questions"), t, body)))
                .containsExactlyInAnyOrder("200:", "409:FORUM_DUPLICATE_POST");

        String q = ask(helperToken, "Question near the answer cap", "Already has 199 answers.");
        UUID seed = user("seed@example.com", null);
        jdbc.batchUpdate("INSERT INTO techverse.forum_posts(user_id, parent_id, content) VALUES (?, ?::uuid, ?)",
                java.util.stream.IntStream.range(0, 199).mapToObj(i -> new Object[] {seed, q, "Seeded answer " + i}).toList());
        assertThat(race(List.of(askerToken, thirdToken), t -> send(post(API + "/questions/" + q + "/answers"), t, Map.of("content", "Racing for slot 200"))))
                .containsExactlyInAnyOrder("200:", "409:FORUM_ANSWER_LIMIT");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.forum_posts WHERE parent_id=?::uuid", Integer.class, q)).isEqualTo(200);

        // Naming another question as the answer is refused without locking that question (no lock-order deadlock).
        String mineQ = ask(askerToken, "Asker question for the swap", "Body of the asker question.");
        String theirsQ = ask(thirdToken, "Third question for the swap", "Body of the third question.");
        try (var conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try (var st = conn.prepareStatement("SELECT 1 FROM techverse.forum_posts WHERE id=?::uuid FOR UPDATE")) {
                st.setString(1, theirsQ);
                st.executeQuery();
            }
            var pool = Executors.newSingleThreadExecutor();
            try {
                var status = pool.submit(() -> accept(mineQ, askerToken, theirsQ).andReturn().getResponse().getContentAsString());
                assertThat(status.get(10, TimeUnit.SECONDS)).contains("FORUM_ANSWER_INVALID");
            } finally {
                conn.rollback();
                pool.shutdownNow();
            }
        }
    }

}
