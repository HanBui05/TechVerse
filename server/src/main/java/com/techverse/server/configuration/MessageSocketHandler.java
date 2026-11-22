package com.techverse.server.configuration;

import com.techverse.server.dto.response.ConversationResponse.SocketTicket;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.OAuth2Properties;
import com.techverse.server.repository.AuthSessionRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.impl.ConversationService;

import jakarta.annotation.PreDestroy;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

/**
 * Event-only messaging socket. The handshake spends a one-use ticket (no JWT in the URL); the server keeps each user's
 * connections in memory and picks the recipients itself, so a browser cannot subscribe to anything. Before every push the
 * ticket's session, token expiry and account are checked again; a failed check or send closes that connection.
 * Tickets, query strings and events are never logged.
 */
@Component
@RequiredArgsConstructor
public class MessageSocketHandler extends TextWebSocketHandler implements HandshakeInterceptor {
    static final String PATH = "/ws/messaging";
    static final int MAX_CONNECTIONS = 5;
    private static final String TICKET_KEY = "messaging:ticket:";
    private static final Duration TICKET_TTL = Duration.ofSeconds(30);
    private static final String ATTR = "messaging.ticket";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final StringRedisTemplate redis;
    private final AuthSessionRepository sessions;
    private final UserRepository users;
    private final OAuth2Properties oauth2;

    private final Map<UUID, Deque<WebSocketSession>> open = new HashMap<>();
    // shortcut: connections live in this server's memory only; move to a broker when running more than one server.
    private final ExecutorService senders = Executors.newVirtualThreadPerTaskExecutor();
    /** Tail of each user's event queue: one user's events stay in order, users never wait on each other. */
    private final Map<UUID, CompletableFuture<Void>> queues = new ConcurrentHashMap<>();
    /** Only fires expiry timers; the close itself runs on a sender thread, so a stuck socket cannot hold it up. */
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> {
        var t = new Thread(r, "messaging-socket");
        t.setDaemon(true);
        return t;
    });

    /** What a ticket stands for: the user, the login session and the expiry of the access token used to get it. */
    record Ticket(UUID user, String sid, Instant exp) {
        String value() {
            return user + " " + sid + " " + exp.toEpochMilli();
        }

        static Ticket parse(String value) {
            var p = value.split(" ");
            return new Ticket(UUID.fromString(p[0]), p[1], Instant.ofEpochMilli(Long.parseLong(p[2])));
        }
    }

    // ------------------------------------------------------------------ tickets

    public SocketTicket issueTicket(UUID user, String sid, Instant tokenExpiresAt) {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        try {
            redis.opsForValue().set(TICKET_KEY + ticket, new Ticket(user, sid, tokenExpiresAt).value(), TICKET_TTL);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.MESSAGE_STORAGE_UNAVAILABLE);
        }
        return new SocketTicket(ticket, Instant.now().plus(TICKET_TTL));
    }

    /** Origin first (a wrong one leaves the ticket usable), then the atomic GETDEL, then session, expiry and account. */
    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler, Map<String, Object> attributes) {
        HttpStatus refusal = admit(request, attributes);
        if (refusal != null) response.setStatusCode(refusal);
        return refusal == null;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler, Exception exception) {}

    private HttpStatus admit(ServerHttpRequest request, Map<String, Object> attributes) {
        if (!oauth2.webUrl().equals(request.getHeaders().getOrigin())) return HttpStatus.FORBIDDEN;
        String ticket = ((ServletServerHttpRequest) request).getServletRequest().getParameter("ticket");
        if (ticket == null || ticket.isBlank()) return HttpStatus.UNAUTHORIZED;
        try {
            String value = redis.opsForValue().getAndDelete(TICKET_KEY + ticket);
            if (value == null) return HttpStatus.UNAUTHORIZED;
            var t = Ticket.parse(value);
            if (!live(t)) return HttpStatus.UNAUTHORIZED;
            if (!canMessage(t.user())) return HttpStatus.FORBIDDEN;
            attributes.put(ATTR, t);
            return null;
        } catch (DataAccessException e) {
            return HttpStatus.SERVICE_UNAVAILABLE;
        }
    }

    /** The token has not expired and its login session still exists for the same user. */
    private boolean live(Ticket t) {
        Instant now = Instant.now();
        return t.exp().isAfter(now) && sessions.findById(t.sid())
                .filter(s -> t.user().toString().equals(s.getUserId()) && s.getExpiresAt() != null && s.getExpiresAt().isAfter(now))
                .isPresent();
    }

    private boolean canMessage(UUID user) {
        return ConversationService.canMessage(users.findWithRolesById(user).orElse(null));
    }

    // ------------------------------------------------------------------ connections

    @Override
    public void afterConnectionEstablished(WebSocketSession raw) {
        var t = (Ticket) raw.getAttributes().get(ATTR);
        WebSocketSession session = new ConcurrentWebSocketSessionDecorator(raw, 5_000, 64 * 1024);
        WebSocketSession oldest = null;
        synchronized (open) {
            var mine = open.computeIfAbsent(t.user(), k -> new ArrayDeque<>());
            mine.addLast(session);
            if (mine.size() > MAX_CONNECTIONS) oldest = mine.pollFirst();
        }
        if (oldest != null) close(oldest, CloseStatus.NORMAL);
        long delay = Math.max(0, Duration.between(Instant.now(), t.exp()).toMillis());
        timer.schedule(() -> senders.execute(() -> drop(t.user(), session, CloseStatus.NORMAL)), delay, TimeUnit.MILLISECONDS);
    }

    /** Open connections of one user, as registered by {@link #afterConnectionEstablished}. */
    public int connections(UUID user) {
        synchronized (open) {
            return open.getOrDefault(user, new ArrayDeque<>()).size();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        if (session.getAttributes().get(ATTR) instanceof Ticket t) forget(t.user(), session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        if (session.getAttributes().get(ATTR) instanceof Ticket t) drop(t.user(), session, CloseStatus.SERVER_ERROR);
    }

    // Text sent by the browser is ignored (TextWebSocketHandler's default); binary closes the connection.

    /**
     * Queues one event for each user's open connections; never blocks the caller. A send stuck on a client that stopped
     * reading holds up only that user's queue until the decorator's limits or the container's send timeout close it.
     */
    public void push(Collection<UUID> to, String event) {
        for (UUID user : to) {
            var next = queues.compute(user, (k, tail) -> (tail == null ? CompletableFuture.<Void>completedFuture(null) : tail)
                    .thenRunAsync(() -> deliver(user, event), senders).exceptionally(e -> null));
            next.whenComplete((r, e) -> queues.remove(user, next));
        }
    }

    private void deliver(UUID user, String event) {
        List<WebSocketSession> targets;
        synchronized (open) {
            targets = List.copyOf(open.getOrDefault(user, new ArrayDeque<>()));
        }
        if (targets.isEmpty()) return;
        boolean allowed = check(() -> canMessage(user));
        for (var s : targets) {
            var t = (Ticket) s.getAttributes().get(ATTR);
            if (!allowed || !check(() -> live(t))) {
                drop(user, s, CloseStatus.POLICY_VIOLATION);
                continue;
            }
            try {
                s.sendMessage(new TextMessage(event));
            } catch (Exception e) {
                drop(user, s, CloseStatus.SERVER_ERROR);
            }
        }
    }

    /** Any failure while checking (database, Redis) counts as "no". */
    private static boolean check(Callable<Boolean> test) {
        try {
            return test.call();
        } catch (Exception e) {
            return false;
        }
    }

    private void drop(UUID user, WebSocketSession session, CloseStatus status) {
        forget(user, session);
        close(session, status);
    }

    private void forget(UUID user, WebSocketSession session) {
        synchronized (open) {
            var mine = open.get(user);
            if (mine != null) {
                mine.removeIf(x -> x.getId().equals(session.getId()));
                if (mine.isEmpty()) open.remove(user);
            }
        }
    }

    private static void close(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) session.close(status);
        } catch (Exception ignored) {
            // Already gone; nothing to release.
        }
    }

    @PreDestroy
    void stop() {
        timer.shutdownNow();
        senders.shutdownNow();
    }
}
