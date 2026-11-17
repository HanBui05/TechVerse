package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.techverse.server.service.impl.PayosClient;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import tools.jackson.databind.ObjectMapper;

import java.net.http.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/** payOS link creation over a fake HTTP client: signature, order number, lookup-first and failures. */
class PayosClientTest {
    static final String CODE = "TV000000000042";
    static final String URL = "https://techverse.test/me/orders/" + CODE;
    static final Instant DEADLINE = Instant.parse("2026-11-16T10:15:00Z");

    HttpClient http = mock(HttpClient.class);
    ObjectMapper mapper = new ObjectMapper();
    PayosClient client = new PayosClient(http, mapper);

    @BeforeEach
    void configure() {
        set("clientId", "client-id-test");
        set("apiKey", "api-key-test");
        set("checksumKey", "checksum-key-test");
        set("returnBaseUrl", "https://techverse.test/");
    }

    @Test
    void createBodySignsTheFiveFieldsInAlphabeticalOrderWithOrderNumberAndShortDescription() throws Exception {
        assertThat(PayosClient.orderNo(CODE)).isEqualTo(42L);
        assertThat(PayosClient.orderNo("TV999999999999")).isEqualTo(999_999_999_999L);
        assertThat(PayosClient.description("TV000123456789")).isEqualTo("TV3456789");

        var body = mapper.readTree(client.createBody(CODE, 199_000, DEADLINE));
        assertThat(body.path("orderCode").asLong()).isEqualTo(42);
        assertThat(body.path("amount").asLong()).isEqualTo(199_000);
        assertThat(body.path("description").asText()).isEqualTo("TV0000042");
        assertThat(body.path("returnUrl").asText()).isEqualTo(URL);
        assertThat(body.path("cancelUrl").asText()).isEqualTo(URL);
        assertThat(body.path("expiredAt").asLong()).isEqualTo(DEADLINE.getEpochSecond());
        // HMAC-SHA256("checksum-key-test", "amount=199000&cancelUrl=<URL>&description=TV0000042&orderCode=42&returnUrl=<URL>")
        assertThat(body.path("signature").asText()).isEqualTo("a984aadd78d9c1da4f270e6d6465cf4bc9113ab72be52d3626949b13d87dd8e7");
    }

    @Test
    void looksUpFirstAndUsesAnExistingLinkWithoutCreating() {
        reply(200, found("link_1"));
        assertThat(client.link(CODE, 199_000, DEADLINE)).isEqualTo("link_1");

        var request = requests(1).getFirst();
        assertThat(request.method()).isEqualTo("GET");
        assertThat(request.uri().toString()).isEqualTo("https://api-merchant.payos.vn/v2/payment-requests/42");
        assertThat(request.headers().firstValue("x-client-id")).contains("client-id-test");
        assertThat(request.headers().firstValue("x-api-key")).contains("api-key-test");
        assertThat(request.timeout()).contains(Duration.ofSeconds(10));
    }

    @Test
    void createsWhenMissingAndLooksUpAgainWhenPayosSaysTheOrderExists() {
        reply(200, "{\"code\":\"101\",\"desc\":\"not found\"}");
        reply(200, created("link_new"));
        assertThat(client.link(CODE, 199_000, DEADLINE)).isEqualTo("link_new");
        assertThat(requests(2).get(1).method()).isEqualTo("POST");

        reset(http);
        reply(200, "{\"code\":\"101\",\"desc\":\"not found\"}");
        reply(200, "{\"code\":\"231\",\"desc\":\"order exists\"}");
        reply(200, found("link_old"));
        assertThat(client.link(CODE, 199_000, DEADLINE)).isEqualTo("link_old");
        assertThat(requests(3)).extracting(HttpRequest::method).containsExactly("GET", "POST", "GET");

        reset(http);
        reply(200, "{\"code\":\"101\",\"desc\":\"not found\"}");
        reply(200, "{\"code\":\"20\",\"desc\":\"rejected\"}");
        reply(200, "{\"code\":\"101\",\"desc\":\"not found\"}");
        assertThatThrownBy(() -> client.link(CODE, 199_000, DEADLINE)).isInstanceOf(PayosClient.PayosException.class);
    }

    @Test
    void timeoutStopsTheCallAndNeverCreatesAfterAFailedLookup() {
        assertThat(ReflectionTestUtils.getField(client, "timeout")).isEqualTo(Duration.ofSeconds(10));
        ReflectionTestUtils.setField(client, "timeout", Duration.ofMillis(50));
        var hanging = new CompletableFuture<HttpResponse<String>>();
        doReturn(hanging).when(http).sendAsync(any(), any());
        assertThatThrownBy(() -> client.link(CODE, 199_000, DEADLINE)).isInstanceOf(PayosClient.PayosException.class);
        assertThat(hanging).isCancelled();
        requests(1);
    }

    @Test
    void missingOrUnsafeDataAndServerErrorsAreControlledFailures() {
        for (var bad : List.of(
                Map.entry(200, "{\"code\":\"00\",\"data\":{\"orderCode\":42}}"),
                Map.entry(200, found("../evil")),
                Map.entry(200, "{\"code\":\"00\",\"data\":{\"id\":\"link_1\",\"orderCode\":43,\"amount\":199000}}"),
                Map.entry(200, "{\"code\":\"00\",\"data\":{\"id\":\"link_1\",\"orderCode\":42,\"amount\":99000}}"),
                Map.entry(200, "{\"code\":\"00\",\"data\":{\"id\":\"link_1\",\"orderCode\":42}}"),
                Map.entry(200, "not json"),
                Map.entry(200, "{\"desc\":\"no code\"}"),
                Map.entry(429, "{\"code\":\"429\"}"),
                Map.entry(502, "Bad gateway"))) {
            reset(http);
            reply(bad.getKey(), bad.getValue());
            assertThatThrownBy(() -> client.link(CODE, 199_000, DEADLINE)).as(bad.toString())
                    .isInstanceOf(PayosClient.PayosException.class);
        }
        // Created link for another amount or order is not ours.
        reset(http);
        reply(200, "{\"code\":\"101\"}");
        reply(200, "{\"code\":\"00\",\"data\":{\"paymentLinkId\":\"link_1\",\"orderCode\":42,\"amount\":1}}");
        assertThatThrownBy(() -> client.link(CODE, 199_000, DEADLINE)).isInstanceOf(PayosClient.PayosException.class);
    }

    @Test
    void enabledOnlyWithAllFourSettingsAndAnAbsoluteHttpReturnUrl() {
        assertThat(client.enabled()).isTrue();
        set("returnBaseUrl", "http://localhost:3000");
        assertThat(client.enabled()).isTrue();
        for (var bad : new String[][] {
                {"clientId", ""}, {"clientId", null}, {"apiKey", " "}, {"checksumKey", ""},
                {"returnBaseUrl", ""}, {"returnBaseUrl", "/me"}, {"returnBaseUrl", "ftp://techverse.test"},
                {"returnBaseUrl", "not a url"}, {"returnBaseUrl", "https://"}}) {
            configure();
            set(bad[0], bad[1]);
            assertThat(client.enabled()).as("%s=%s", bad[0], bad[1]).isFalse();
        }
    }

    @Test
    void lookupReturnsStatusAndAmountsAndNothingWhenPayosDoesNotKnowTheOrder() {
        reply(200, "{\"code\":\"00\",\"data\":{\"id\":\"link_1\",\"orderCode\":42,\"amount\":199000,\"amountPaid\":50000,\"status\":\"PENDING\"}}");
        assertThat(client.lookup(42)).contains(new PayosClient.Payment("link_1", 42L, "PENDING", 199_000L, 50_000L));
        assertThat(requests(1).getFirst().uri().toString()).isEqualTo("https://api-merchant.payos.vn/v2/payment-requests/42");

        reset(http);
        reply(200, "{\"code\":\"101\",\"desc\":\"not found\"}");
        assertThat(client.lookup(42)).isEmpty();

        // Unsafe link id and non-numeric amounts count as missing; the caller refuses to act on them.
        reset(http);
        reply(200, "{\"code\":\"00\",\"data\":{\"id\":\"../x\",\"orderCode\":42,\"amount\":\"199000\",\"status\":\"PAID\"}}");
        assertThat(client.lookup(42)).contains(new PayosClient.Payment(null, 42L, "PAID", null, null));

        reset(http);
        reply(502, "Bad gateway");
        assertThatThrownBy(() -> client.lookup(42)).isInstanceOf(PayosClient.PayosException.class);
    }

    @Test
    void webhookSignatureSortsKeysTurnsNullIntoEmptyAndNestedValuesIntoSortedJson() {
        String data = "{\"orderCode\":42,\"amount\":199000,\"description\":\"TV0000042\",\"reference\":null,"
                + "\"paymentLinkId\":\"link_1\",\"extra\":{\"b\":1,\"a\":[{\"y\":2,\"x\":null}]},\"success\":true,\"code\":\"00\"}";
        String canonical = "amount=199000&code=00&description=TV0000042&extra={\"a\":[{\"x\":null,\"y\":2}],\"b\":1}"
                + "&orderCode=42&paymentLinkId=link_1&reference=&success=true";
        String signature = hmac("checksum-key-test", canonical);
        assertThat(client.webhookOrderNo(webhook(data, signature))).hasValue(42);

        char last = signature.charAt(signature.length() - 1);
        String oneOff = signature.substring(0, signature.length() - 1) + (last == '0' ? '1' : '0');
        assertThat(client.webhookOrderNo(webhook(data, oneOff))).isEmpty();
        assertThat(client.webhookOrderNo(webhook(data, hmac("another-key", canonical)))).isEmpty();
        assertThat(client.webhookOrderNo(webhook(data.replace("199000", "1"), signature))).isEmpty();

        for (String bad : List.of("not json", "[]", "{\"signature\":\"" + signature + "\"}", "{\"data\":" + data + "}",
                "{\"data\":\"x\",\"signature\":\"" + signature + "\"}")) {
            assertThat(client.webhookOrderNo(bad.getBytes(java.nio.charset.StandardCharsets.UTF_8))).as(bad).isEmpty();
        }
        String noOrder = "{\"amount\":1}";
        assertThat(client.webhookOrderNo(webhook(noOrder, hmac("checksum-key-test", "amount=1")))).isEmpty();

        set("apiKey", "");
        assertThat(client.webhookOrderNo(webhook(data, signature))).as("payOS off").isEmpty();
    }

    static byte[] webhook(String data, String signature) {
        return ("{\"code\":\"00\",\"desc\":\"success\",\"success\":true,\"data\":" + data + ",\"signature\":\"" + signature + "\"}")
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    static String hmac(String key, String text) {
        try {
            var mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(key.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------------ fakes

    final List<CompletableFuture<HttpResponse<String>>> replies = new ArrayList<>();

    @SuppressWarnings("unchecked")
    void reply(int status, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        // Replies are served in order; the last one repeats.
        replies.add(CompletableFuture.completedFuture(response));
        var queue = new ArrayDeque<>(replies);
        doAnswer(i -> queue.size() > 1 ? queue.poll() : queue.peek()).when(http).sendAsync(any(), any());
    }

    List<HttpRequest> requests(int count) {
        var captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http, times(count)).sendAsync(captor.capture(), any());
        return captor.getAllValues();
    }

    void reset(HttpClient mock) {
        org.mockito.Mockito.reset(mock);
        replies.clear();
    }

    static String found(String id) {
        return "{\"code\":\"00\",\"desc\":\"success\",\"data\":{\"id\":\"" + id + "\",\"orderCode\":42,\"amount\":199000,\"status\":\"PENDING\"}}";
    }

    static String created(String id) {
        return "{\"code\":\"00\",\"desc\":\"success\",\"data\":{\"paymentLinkId\":\"" + id
                + "\",\"orderCode\":42,\"amount\":199000,\"checkoutUrl\":\"https://pay.payos.vn/web/" + id + "\"}}";
    }

    void set(String field, Object value) {
        ReflectionTestUtils.setField(client, field, value);
    }
}
