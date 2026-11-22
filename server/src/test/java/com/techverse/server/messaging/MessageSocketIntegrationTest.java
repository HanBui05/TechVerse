package com.techverse.server.messaging;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.configuration.MessageSocketHandler;
import com.techverse.server.properties.OAuth2Properties;
import com.techverse.server.service.TokenService;
import com.techverse.server.service.impl.ConversationService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/** Real WebSocket clients against a random port: tickets, who receives which event, after-commit only, revocation and expiry. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "spring.jpa.properties.hibernate.generate_statistics=true")
class MessageSocketIntegrationTest extends ConversationIntegrationTestBase {
    @LocalServerPort int port;
    @Autowired OAuth2Properties oauth2;
    @Autowired ConversationService service;
    @Autowired PlatformTransactionManager txManager;
    @Autowired TokenService tokens;
    @Autowired @Qualifier("accessTokenDecoder") JwtDecoder decoder;
    @Autowired MessageSocketHandler socket;

    record Conn(WebSocket ws, BlockingQueue<String> events, CompletableFuture<Integer> closed) {
        String next() throws InterruptedException {
            return events.poll(5, TimeUnit.SECONDS);
        }

        /** Nothing arrives within a short wait. */
        void quiet() throws InterruptedException {
            assertThat(events.poll(1, TimeUnit.SECONDS)).isNull();
        }
    }

    String ticket(String token) throws Exception {
        return data(send(post(API + "/socket-ticket"), token, null).andExpect(status().isOk())).path("ticket").asText();
    }

    String sid(String token) {
        return decoder.decode(token).getClaimAsString("sid");
    }

    CompletableFuture<Conn> start(String ticket, String origin) {
        var events = new LinkedBlockingQueue<String>();
        var closed = new CompletableFuture<Integer>();
        var b = HttpClient.newHttpClient().newWebSocketBuilder();
        if (origin != null) b.header("Origin", origin);
        String q = ticket == null ? "" : "?ticket=" + ticket;
        return b.buildAsync(URI.create("ws://localhost:" + port + "/ws/messaging" + q), new WebSocket.Listener() {
            final StringBuilder part = new StringBuilder();

            @Override
            public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
                part.append(data);
                if (last) {
                    events.add(part.toString());
                    part.setLength(0);
                }
                ws.request(1);
                return null;
            }

            @Override
            public CompletionStage<?> onClose(WebSocket ws, int code, String reason) {
                closed.complete(code);
                return null;
            }

            @Override
            public void onError(WebSocket ws, Throwable error) {
                closed.complete(-1);
            }
        }).thenApply(ws -> new Conn(ws, events, closed));
    }

    /**
     * The client sees the handshake done before the server registers the session, so an event pushed in between is
     * lost (the browser catches up over REST); wait for the registration so tests see every event.
     */
    Conn connect(String ticket) throws Exception {
        UUID user = UUID.fromString(redisTemplate.opsForValue().get("messaging:ticket:" + ticket).split(" ")[0]);
        int before = socket.connections(user);
        var conn = start(ticket, oauth2.webUrl()).get(10, TimeUnit.SECONDS);
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (socket.connections(user) <= before) {
            if (System.nanoTime() > deadline) throw new AssertionError("server never registered the connection");
            Thread.sleep(10);
        }
        return conn;
    }

    /** The HTTP status of a refused handshake. */
    int refused(String ticket, String origin) throws Exception {
        try {
            start(ticket, origin).get(10, TimeUnit.SECONDS);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof WebSocketHandshakeException h) return h.getResponse().statusCode();
            throw e;
        }
        throw new AssertionError("handshake was accepted");
    }

    String openConversation() throws Exception {
        return data(open(learnerToken, course1).andExpect(status().isOk())).path("id").asText();
    }

    @Test
    void ticketsAreOneUseAndChecked() throws Exception {
        String t = ticket(learnerToken);
        assertThat(refused(t, "https://evil.example")).isEqualTo(403);
        assertThat(refused(t, null)).isEqualTo(403);
        connect(t).ws().abort();
        assertThat(refused(t, oauth2.webUrl())).isEqualTo(401);
        assertThat(refused(null, oauth2.webUrl())).isEqualTo(401);
        assertThat(refused("not-a-ticket", oauth2.webUrl())).isEqualTo(401);

        String shared = ticket(learnerToken);
        var a = start(shared, oauth2.webUrl());
        var b = start(shared, oauth2.webUrl());
        int ok = 0, denied = 0;
        for (var f : List.of(a, b)) {
            try {
                f.get(10, TimeUnit.SECONDS).ws().abort();
                ok++;
            } catch (ExecutionException e) {
                assertThat(((WebSocketHandshakeException) e.getCause()).getResponse().statusCode()).isEqualTo(401);
                denied++;
            }
        }
        assertThat(List.of(ok, denied)).containsExactly(1, 1);

        send(post(API + "/socket-ticket"), null, null).andExpect(status().isUnauthorized());
        send(post(API + "/socket-ticket"), modToken, null).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        send(post(API + "/socket-ticket"), multiToken, null).andExpect(status().isForbidden());
    }

    @Test
    void aNewMessageSignalsBothParticipantsWithTheSeqAndNoOneElse() throws Exception {
        var learnerConn = connect(ticket(learnerToken));
        var authorConn = connect(ticket(authorToken));
        var third = connect(ticket(thirdToken));
        String id = openConversation();
        // seq is one identity for the whole table (TRUNCATE keeps it), so take it from the reply rather than assume 1.
        long seq = data(message(id, learnerToken, "secret text").andExpect(status().isCreated())).path("seq").asLong();
        assertThat(seq).isPositive();

        String expected = "{\"type\":\"message\",\"conversationId\":\"" + id + "\",\"seq\":" + seq + "}";
        assertThat(authorConn.next()).as("author closed=%s", authorConn.closed().getNow(null)).isEqualTo(expected);
        assertThat(authorConn.next()).isEqualTo("{\"type\":\"unread\"}");
        assertThat(learnerConn.next()).as("learner closed=%s", learnerConn.closed().getNow(null)).isEqualTo(expected);
        learnerConn.quiet();
        third.quiet();
    }

    @Test
    void eventsAreSentOnlyAfterCommit() throws Exception {
        var learnerConn = connect(ticket(learnerToken));
        var authorConn = connect(ticket(authorToken));
        UUID id = UUID.fromString(openConversation());
        var tx = new TransactionTemplate(txManager);
        tx.executeWithoutResult(s -> {
            service.send(learner, id, "rolled back", UUID.randomUUID());
            s.setRollbackOnly();
        });
        authorConn.quiet();
        tx.executeWithoutResult(s -> service.send(learner, id, "kept", UUID.randomUUID()));
        assertThat(authorConn.next()).contains("\"type\":\"message\"").contains("\"seq\":");
        assertThat(authorConn.next()).isEqualTo("{\"type\":\"unread\"}");
        assertThat(learnerConn.next()).contains("\"type\":\"message\"");

        send(put(API + "/" + id + "/block"), learnerToken, Map.of("blocked", true)).andExpect(status().isOk());
        String state = "{\"type\":\"state\",\"conversationId\":\"" + id + "\"}";
        assertThat(learnerConn.next()).isEqualTo(state);
        assertThat(authorConn.next()).isEqualTo(state);

        send(put(API + "/" + id + "/read"), authorToken, Map.of("seq", Long.MAX_VALUE)).andExpect(status().isOk());
        assertThat(authorConn.next()).isEqualTo("{\"type\":\"unread\"}");
        learnerConn.quiet();
    }

    @Test
    void revokedSessionsAndLockedAccountsStopReceivingAndAreClosed() throws Exception {
        String id = openConversation();
        message(id, learnerToken, "hello").andExpect(status().isCreated());
        message(id, authorToken, "reply").andExpect(status().isCreated());

        var learnerConn = connect(ticket(learnerToken));
        String early = ticket(learnerToken);
        tokens.deleteAllTokensByUserId(learner);
        message(id, authorToken, "after logout").andExpect(status().isCreated());
        assertThat(learnerConn.closed().get(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(learnerConn.events()).isEmpty();
        assertThat(refused(early, oauth2.webUrl())).isEqualTo(401);

        learnerToken = login("learner@example.com");
        var authorConn = connect(ticket(authorToken));
        String authorTicket = ticket(authorToken);
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", author);
        message(id, learnerToken, "to a locked author").andExpect(status().isCreated());
        assertThat(authorConn.closed().get(5, TimeUnit.SECONDS)).isNotNull();
        assertThat(authorConn.events()).isEmpty();
        assertThat(refused(authorTicket, oauth2.webUrl())).isEqualTo(403);
    }

    @Test
    void connectionsCloseAtTheAccessTokenExpiry() throws Exception {
        String id = openConversation();
        String sid = sid(authorToken);
        var expired = service.socketTicket(author, sid, Instant.now().minusSeconds(1));
        assertThat(refused(expired.ticket(), oauth2.webUrl())).isEqualTo(401);

        var conn = connect(service.socketTicket(author, sid, Instant.now().plusSeconds(2)).ticket());
        assertThat(conn.closed().get(6, TimeUnit.SECONDS)).isNotNull();
        message(id, learnerToken, "after expiry").andExpect(status().isCreated());
        Thread.sleep(500);
        assertThat(conn.events()).isEmpty();
    }
}
