package com.techverse.server.service.impl;

import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * payOS payment-request API: look up and create the link of one order. Never logs keys, signatures or
 * payloads. Each call is cut at {@link #timeout}, so a lookup-create-lookup round ends within 30 seconds.
 */
@Slf4j
@Service
public class PayosClient {
    static final String API = "https://api-merchant.payos.vn/v2/payment-requests";
    /** The link id goes into {@code https://pay.payos.vn/web/{id}}; anything else is refused. */
    private static final Pattern LINK_ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");

    private final HttpClient http;
    private final ObjectMapper mapper;
    Duration timeout = Duration.ofSeconds(10);

    @Value("${payos.client-id:}")
    private String clientId;

    @Value("${payos.api-key:}")
    private String apiKey;

    @Value("${payos.checksum-key:}")
    private String checksumKey;

    @Value("${payos.return-base-url:}")
    private String returnBaseUrl;

    @Autowired
    public PayosClient(ObjectMapper mapper) {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build(), mapper);
    }

    public PayosClient(HttpClient http, ObjectMapper mapper) {
        this.http = http;
        this.mapper = mapper;
    }

    /** A controlled failure: timeout, transport error, 429/5xx or a reply missing what we need. */
    public static class PayosException extends RuntimeException {
        public PayosException(String message) {
            super(message);
        }
    }

    /** payOS answered with a business error code (for example "order already exists"). */
    static class Rejected extends PayosException {
        Rejected(String code) {
            super("payOS rejected the request: " + code);
        }
    }

    /** All four settings present and the return base an absolute http(s) URL; otherwise payOS is off. */
    public boolean enabled() {
        if (blank(clientId) || blank(apiKey) || blank(checksumKey) || blank(returnBaseUrl)) return false;
        try {
            URI uri = new URI(returnBaseUrl.strip());
            return ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) && uri.getHost() != null;
        } catch (java.net.URISyntaxException e) {
            return false;
        }
    }

    /** The payOS orderCode: the 12 digits of {@code TV…}. */
    public static long orderNo(String code) {
        return Long.parseLong(code.substring(2));
    }

    /** At most 9 characters (payOS limit); for the payer's eyes only, never used to match. */
    public static String description(String code) {
        return "TV" + code.substring(code.length() - 7);
    }

    /** The order's link id: looks up first, creates when missing, looks up again when payOS says it exists. */
    public String link(String code, long amount, Instant expiresAt) {
        long no = orderNo(code);
        var found = find(no, amount);
        if (found.isPresent()) return found.get();
        try {
            return create(code, amount, expiresAt);
        } catch (Rejected e) {
            return find(no, amount).orElseThrow(() -> e);
        }
    }

    /**
     * The link id payOS holds for this order number; empty when payOS answers with an error code. A link
     * for another amount is never handed out: the buyer would pay a sum that does not pay the order.
     */
    public Optional<String> find(long orderNo, long amount) {
        JsonNode reply = call(request("/" + orderNo).GET().build());
        if (!"00".equals(reply.path("code").asText())) return Optional.empty();
        JsonNode data = reply.path("data");
        if (data.path("orderCode").asLong(-1) != orderNo || data.path("amount").asLong(-1) != amount)
            throw new PayosException("payOS lookup returned another order or amount");
        return Optional.of(linkId(data.path("id")));
    }

    public String create(String code, long amount, Instant expiresAt) {
        JsonNode reply = call(request("").header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(createBody(code, amount, expiresAt))).build());
        String result = reply.path("code").asText();
        if (!"00".equals(result)) throw new Rejected(result);
        JsonNode data = reply.path("data");
        if (data.path("orderCode").asLong(-1) != orderNo(code) || data.path("amount").asLong(-1) != amount)
            throw new PayosException("payOS created a link for another order or amount");
        return linkId(data.path("paymentLinkId"));
    }

    public String createBody(String code, long amount, Instant expiresAt) {
        String url = returnBaseUrl.strip().replaceAll("/+$", "") + "/me/orders/" + code;
        String description = description(code);
        long no = orderNo(code);
        var body = new LinkedHashMap<String, Object>();
        body.put("orderCode", no);
        body.put("amount", amount);
        body.put("description", description);
        body.put("returnUrl", url);
        body.put("cancelUrl", url);
        body.put("expiredAt", expiresAt.getEpochSecond());
        body.put("signature", sign("amount=" + amount + "&cancelUrl=" + url + "&description=" + description
                + "&orderCode=" + no + "&returnUrl=" + url));
        return mapper.writeValueAsString(body);
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(checksumKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create(API + path))
                .timeout(timeout)
                .header("x-client-id", clientId)
                .header("x-api-key", apiKey);
    }

    private JsonNode call(HttpRequest request) {
        var pending = http.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        HttpResponse<String> response;
        try {
            // Hard cap whatever the client does with connect and read timeouts.
            response = pending.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            pending.cancel(true);
            throw new PayosException("payOS timed out");
        } catch (InterruptedException e) {
            pending.cancel(true);
            Thread.currentThread().interrupt();
            throw new PayosException("interrupted");
        } catch (ExecutionException e) {
            throw new PayosException("payOS unreachable");
        }
        if (response.statusCode() == 429 || response.statusCode() >= 500)
            throw new PayosException("payOS HTTP " + response.statusCode());
        JsonNode body;
        try {
            body = mapper.readTree(response.body());
        } catch (RuntimeException e) {
            throw new PayosException("payOS reply is not JSON");
        }
        if (body == null || !body.path("code").isTextual()) throw new PayosException("payOS reply has no code");
        return body;
    }

    private static String linkId(JsonNode node) {
        String id = node.isTextual() ? node.asText() : "";
        if (!LINK_ID.matcher(id).matches()) throw new PayosException("payOS link id missing or malformed");
        return id;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
