package com.techverse.server.messaging;

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

/** Conversations against a real database and security chain, grouped by flow. */
class ConversationIntegrationTest extends ConversationIntegrationTestBase {
    // ------------------------------------------------------------------ (1) opening

    @Test
    void learnerWithoutPurchaseOpensAndReopensWithTheLatestCourseContext() throws Exception {
        var first = data(open(learnerToken, course1).andExpect(status().isOk()));
        String id = first.path("id").asText();
        assertThat(first.path("role").asText()).isEqualTo("LEARNER");
        assertThat(first.at("/other/id").asText()).isEqualTo(author.toString());
        assertThat(first.at("/contextCourse/title").asText()).isEqualTo("Course One");
        assertThat(first.at("/contextCourse/available").asBoolean()).isTrue();
        assertThat(first.path("contextEnrolled").asBoolean()).isFalse();
        assertThat(first.path("canSend").asBoolean()).isTrue();
        assertThat(first.path("remainingBeforeReply").asInt()).isEqualTo(3);

        // Reopening from another course of the same author returns the same conversation with the new context.
        jdbc.update("INSERT INTO techverse.course_enrollments(user_id,course_id,source) VALUES (?,?,'FREE')", learner, course2);
        var again = data(open(learnerToken, course2).andExpect(status().isOk()));
        assertThat(again.path("id").asText()).isEqualTo(id);
        assertThat(again.at("/contextCourse/id").asText()).isEqualTo(course2.toString());
        assertThat(again.path("contextEnrolled").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.conversations", Integer.class)).isEqualTo(1);

        // The context course hidden afterwards: still named, no longer available; cannot open from it.
        jdbc.update("UPDATE techverse.courses SET publication_status='HIDDEN', hidden_from_publication_status='PUBLISHED' WHERE id=?", course2);
        var detail = data(get(API + "/" + id, learnerToken).andExpect(status().isOk()));
        assertThat(detail.at("/contextCourse/title").asText()).isEqualTo("Course Two");
        assertThat(detail.at("/contextCourse/available").asBoolean()).isFalse();
        open(learnerToken, course2).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_ALLOWED"));
        open(authorToken, course1).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_ALLOWED"));
        open(learnerToken, UUID.randomUUID()).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_ALLOWED"));
        send(post(API), learnerToken, Map.of("courseId", "abc")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        send(post(API), null, Map.of("courseId", course1.toString())).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------------ (2) chatting

    @Test
    void learnerWaitsForTheFirstReplyThenBothSidesChatAndRead() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        for (int i = 1; i <= 3; i++) message(id, learnerToken, "Question " + i).andExpect(status().isCreated());
        message(id, learnerToken, "Question 4").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONVERSATION_AWAITING_REPLY"));
        var waiting = data(get(API + "/" + id, learnerToken));
        assertThat(waiting.path("remainingBeforeReply").asInt()).isZero();
        assertThat(waiting.path("canSend").asBoolean()).isFalse();

        // The author sees it as unread; the learner has nothing unread (own messages).
        var authorList = data(get(API, authorToken).andExpect(status().isOk())).path("content");
        assertThat(authorList).hasSize(1);
        assertThat(authorList.get(0).path("role").asText()).isEqualTo("AUTHOR");
        assertThat(authorList.get(0).path("unread").asBoolean()).isTrue();
        assertThat(authorList.get(0).path("lastMessageExcerpt").asText()).isEqualTo("Question 3");
        assertThat(authorList.get(0).path("contextEnrolled").asBoolean()).isFalse();
        assertThat(unread(authorToken)).isEqualTo(1);
        assertThat(unread(learnerToken)).isZero();

        var reply = data(message(id, authorToken, "Answer").andExpect(status().isCreated()));
        assertThat(reply.path("mine").asBoolean()).isTrue();
        var afterReply = data(get(API + "/" + id, learnerToken));
        assertThat(afterReply.path("remainingBeforeReply").isNull()).isTrue();
        assertThat(afterReply.path("canSend").asBoolean()).isTrue();
        assertThat(data(get(API + "/" + id, authorToken)).path("remainingBeforeReply").isNull()).isTrue();
        // Sending does not move the sender's own read marker: the author still has unread until reading.
        assertThat(unread(learnerToken)).isEqualTo(1);
        for (int i = 4; i <= 8; i++) message(id, learnerToken, "Question " + i).andExpect(status().isCreated());

        // Latest page, then older pages, all in ascending seq.
        var latest = data(get(API + "/" + id + "/messages?size=3", learnerToken).andExpect(status().isOk()));
        assertThat(contents(latest)).containsExactly("Question 6", "Question 7", "Question 8");
        assertThat(latest.path("hasMore").asBoolean()).isTrue();
        long oldest = latest.at("/messages/0/seq").asLong();
        var older = data(get(API + "/" + id + "/messages?size=50&beforeSeq=" + oldest, learnerToken));
        assertThat(contents(older)).containsExactly("Question 1", "Question 2", "Question 3", "Answer", "Question 4", "Question 5");
        assertThat(older.path("hasMore").asBoolean()).isFalse();

        // Catching up in pages of 4 from the start until hasMore is false.
        var all = new ArrayList<String>();
        long after = 0;
        boolean more = true;
        while (more) {
            var page = data(get(API + "/" + id + "/messages?size=4&afterSeq=" + after, authorToken));
            all.addAll(contents(page));
            more = page.path("hasMore").asBoolean();
            after = page.at("/messages/" + (page.path("messages").size() - 1) + "/seq").asLong();
        }
        assertThat(all).hasSize(9).startsWith("Question 1").endsWith("Question 8");

        // Reading: never backwards, capped at the last message.
        send(put(API + "/" + id + "/read"), authorToken, Map.of("seq", Long.MAX_VALUE)).andExpect(status().isOk());
        assertThat(unread(authorToken)).isZero();
        send(put(API + "/" + id + "/read"), authorToken, Map.of("seq", 0)).andExpect(status().isOk());
        assertThat(unread(authorToken)).isZero();
        assertThat(jdbc.queryForObject("SELECT author_last_read_seq = last_message_seq FROM techverse.conversations WHERE id=?::uuid", Boolean.class, id))
                .isTrue();
        send(put(API + "/" + id + "/read"), learnerToken, Map.of("seq", -1)).andExpect(status().isBadRequest());
        get(API + "/" + id + "/messages?beforeSeq=5&afterSeq=1", learnerToken).andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------------ (3) privacy

    @Test
    void outsidersGetNotFoundAndStaffOrLockedAccountsAreDenied() throws Exception {
        String id = data(open(learnerToken, course1)).path("id").asText();
        String secret = "Top secret message body";
        message(id, learnerToken, secret).andExpect(status().isCreated());

        var outsider = List.of(
                get(API + "/" + id, thirdToken),
                get(API + "/" + id + "/messages", thirdToken),
                message(id, thirdToken, "Let me in"),
                send(put(API + "/" + id + "/read"), thirdToken, Map.of("seq", 1)),
                get(API + "/" + UUID.randomUUID(), learnerToken));
        for (var r : outsider) {
            r.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
            assertThat(r.andReturn().getResponse().getContentAsString()).doesNotContain(secret);
        }
        assertThat(data(get(API, thirdToken)).path("content")).isEmpty();
        assertThat(unread(thirdToken)).isZero();

        UUID locked = user("locked@example.com", null);
        String lockedToken = login("locked@example.com");
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", locked);
        for (String token : List.of(modToken, adminToken, multiToken, lockedToken)) {
            for (var r : List.of(
                    get(API, token), get(API + "/unread-count", token), get(API + "/" + id, token), get(API + "/" + id + "/messages", token),
                    message(id, token, "Hello"), send(put(API + "/" + id + "/read"), token, Map.of("seq", 1)), open(token, course1))) {
                r.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
                assertThat(r.andReturn().getResponse().getContentAsString()).doesNotContain(secret);
            }
        }
    }

    // ------------------------------------------------------------------ (4) concurrency and idempotency

    @Test
    void racesKeepOneConversationAndClientIdsMakeSendingIdempotent() throws Exception {
        assertThat(race(2, () -> open(learnerToken, course1))).containsOnly("200:");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.conversations", Integer.class)).isEqualTo(1);
        String id = data(open(learnerToken, course1)).path("id").asText();

        // Two authors opening from each other's course at once: both succeed (no deadlock on the user rows).
        UUID second = user("second@example.com", "AUTHOR");
        UUID secondCourse = course(second, "Second course");
        String secondToken = login("second@example.com");
        for (int i = 0; i < 5; i++) {
            jdbc.update("DELETE FROM techverse.conversations WHERE learner_id IN (?,?) AND author_id IN (?,?)", author, second, author, second);
            redisTemplate.delete(redisTemplate.keys("messaging:rate:*"));
            assertThat(race(List.of(authorToken, secondToken), t -> open(t, t.equals(authorToken) ? secondCourse : course1))).containsOnly("200:");
        }

        // The same retry sent twice at once: one 201, one 200, one stored message.
        String retry = UUID.randomUUID().toString();
        assertThat(race(2, () -> send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Retry", "clientId", retry))))
                .containsExactlyInAnyOrder("201:", "200:");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.messages WHERE client_id=?::uuid", Integer.class, retry)).isEqualTo(1);
        jdbc.update("DELETE FROM techverse.messages");
        jdbc.update("UPDATE techverse.conversations SET last_message_seq=NULL, last_message_at=NULL, last_message_sender_id=NULL");

        String clientId = UUID.randomUUID().toString();
        var first = data(send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", " Hello ", "clientId", clientId))
                .andExpect(status().isCreated()));
        var resent = data(send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Hello", "clientId", clientId))
                .andExpect(status().isOk()));
        assertThat(resent.path("id").asText()).isEqualTo(first.path("id").asText());
        send(post(API + "/" + id + "/messages"), learnerToken, Map.of("content", "Different", "clientId", clientId))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MESSAGE_CLIENT_ID_CONFLICT"));
        UUID other = user("other@example.com", "AUTHOR");
        String elsewhere = data(open(learnerToken, course(other, "Other course"))).path("id").asText();
        send(post(API + "/" + elsewhere + "/messages"), learnerToken, Map.of("content", "Hello", "clientId", clientId))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MESSAGE_CLIENT_ID_CONFLICT"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.messages", Integer.class)).isEqualTo(1);

        // Third and fourth messages before any reply, sent together: exactly one is stored.
        message(id, learnerToken, "Second").andExpect(status().isCreated());
        assertThat(race(2, () -> message(id, learnerToken, "Racing " + UUID.randomUUID())))
                .containsExactlyInAnyOrder("201:", "409:CONVERSATION_AWAITING_REPLY");

        // Both sides at once: both stored, the higher seq is the last message.
        message(id, authorToken, "Reply").andExpect(status().isCreated());
        var codes = race(List.of(learnerToken, authorToken), t -> message(id, t, "Same time " + t.hashCode()));
        assertThat(codes).containsOnly("201:");
        assertThat(jdbc.queryForObject("SELECT c.last_message_seq = (SELECT max(seq) FROM techverse.messages m WHERE m.conversation_id=c.id)"
                + " FROM techverse.conversations c WHERE c.id=?::uuid", Boolean.class, id)).isTrue();
    }
}
