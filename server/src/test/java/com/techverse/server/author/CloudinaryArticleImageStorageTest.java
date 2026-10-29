package com.techverse.server.author;

import static org.assertj.core.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import com.techverse.server.dto.internal.DecodedArticleImage;
import com.techverse.server.exception.CustomException;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.service.impl.CloudinaryArticleImageStorage;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

class CloudinaryArticleImageStorageTest {
    @Test
    void uploadUsesScopedPublicIdNoOverwriteAndDurableOwnershipContext() throws Exception {
        UUID owner = UUID.randomUUID(), article = UUID.randomUUID();
        String publicId = "techverse/articles/" + owner + "/" + article + "/" + UUID.randomUUID();
        var requestBody = new AtomicReference<String>();
        var auth = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/v1_1/demo/image/upload",
                exchange -> {
                    auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
                    requestBody.set(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.ISO_8859_1));
                    byte[] response =
                            ("{\"asset_id\":\"asset-one\",\"public_id\":\""
                                            + publicId
                                            + "\",\"secure_url\":\"https://res.cloudinary.com/demo/image/upload/v1/"
                                            + publicId
                                            + ".png\",\"width\":2,\"height\":3,\"created_at\":\"2026-10-29T00:00:00Z\",\"context\":{\"custom\":{\"managed\":\"techverse_article\",\"owner\":\""
                                            + owner
                                            + "\",\"article\":\""
                                            + article
                                            + "\",\"fingerprint\":\"abc\"}}}")
                                    .getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, response.length);
                    exchange.getResponseBody().write(response);
                    exchange.close();
                });
        server.start();
        try {
            var storage =
                    new CloudinaryArticleImageStorage(
                            new CloudinaryProperties(
                                    "demo",
                                    "key",
                                    "secret",
                                    "techverse/articles",
                                    URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
                                    false),
                            new ObjectMapper());
            var asset =
                    storage.upload(
                            publicId,
                            owner,
                            article,
                            DecodedArticleImage.builder()
                                    .bytes(new byte[] {1, 2, 3})
                                    .fingerprint("abc")
                                    .width(2)
                                    .height(3)
                                    .build());
            assertThat(asset.articleId()).isEqualTo(article);
            assertThat(asset.fingerprint()).isEqualTo("abc");
            assertThat(auth.get()).isEqualTo("Basic a2V5OnNlY3JldA==");
            assertThat(requestBody.get())
                    .contains(
                            publicId,
                            "name=\"overwrite\"\r\n\r\nfalse",
                            "managed=techverse_article",
                            "owner=" + owner,
                            "article=" + article);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void lifecycleMetadataIsMergedAndDeletionTargetsTheImmutableAssetId() throws Exception {
        UUID owner = UUID.randomUUID(), article = UUID.randomUUID();
        String publicId = "techverse/articles/" + owner + "/" + article + "/" + UUID.randomUUID();
        var touched = java.time.Instant.parse("2026-10-29T12:00:00Z");
        var contexts = new ArrayList<String>();
        var calls = new ArrayList<String>();
        var retired = new java.util.concurrent.atomic.AtomicBoolean();
        var renewed = new java.util.concurrent.atomic.AtomicBoolean();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/v1_1/demo/",
                exchange -> {
                    String path = exchange.getRequestURI().getPath();
                    String body = "{}";
                    int status = 200;
                    calls.add(exchange.getRequestMethod() + " " + exchange.getRequestURI());
                    if (path.endsWith("/image/context")
                            && exchange.getRequestMethod().equals("POST")) {
                        String form =
                                URLDecoder.decode(
                                        new String(
                                                exchange.getRequestBody().readAllBytes(),
                                                StandardCharsets.UTF_8),
                                        StandardCharsets.UTF_8);
                        contexts.add(form);
                        if (!form.contains("command=add")
                                || !form.contains("public_ids[]=" + publicId)) status = 400;
                        if (form.contains("context=touched_at=" + touched)) renewed.set(true);
                        else if (form.contains("context=retiring=true")) retired.set(true);
                        else status = 400;
                    } else if (exchange.getRequestMethod().equals("GET")
                            && path.endsWith(publicId)) {
                        body =
                                "{\"asset_id\":\"immutable-one\",\"public_id\":\""
                                        + publicId
                                        + "\",\"secure_url\":\"https://res.cloudinary.com/demo/image/upload/v1/"
                                        + publicId
                                        + ".png\",\"width\":2,\"height\":2,\"created_at\":\"2026-10-26T00:00:00Z\","
                                        + "\"context\":{\"custom\":{\"managed\":\"techverse_article\",\"owner\":\""
                                        + owner
                                        + "\",\"article\":\""
                                        + article
                                        + "\",\"fingerprint\":\"abc\""
                                        + (renewed.get()
                                                ? ",\"touched_at\":\"" + touched + "\""
                                                : "")
                                        + (retired.get() ? ",\"retiring\":\"true\"" : "")
                                        + "}}}";
                    } else if (exchange.getRequestMethod().equals("DELETE")
                            && path.endsWith("/resources")) {
                        String query =
                                URLDecoder.decode(
                                        exchange.getRequestURI().getRawQuery(),
                                        StandardCharsets.UTF_8);
                        if (!query.contains("asset_ids[]=immutable-one")
                                || query.contains("public_ids")) status = 400;
                        body = "{\"deleted\":{\"" + publicId + "\":\"deleted\"}}";
                    } else status = 404;
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(status, bytes.length);
                    exchange.getResponseBody().write(bytes);
                    exchange.close();
                });
        server.start();
        try {
            var storage =
                    new CloudinaryArticleImageStorage(
                            new CloudinaryProperties(
                                    "demo",
                                    "key",
                                    "secret",
                                    "techverse/articles",
                                    URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
                                    false),
                            new ObjectMapper());
            var asset = storage.find(publicId).orElseThrow();
            var live = storage.renew(asset, touched);
            assertThat(live.touchedAt()).isEqualTo(touched);
            assertThat(live.ownerId()).isEqualTo(owner);
            var retiring = storage.retire(live);
            assertThat(retiring.retiring()).isTrue();
            assertThat(storage.renew(retiring, touched).retiring()).isTrue();
            storage.delete(retiring.assetId());
            assertThat(contexts)
                    .hasSize(3)
                    .allSatisfy(
                            form ->
                                    assertThat(form)
                                            .doesNotContain("retiring=false", "remove_all"));
            assertThat(calls.get(calls.size() - 1))
                    .startsWith("DELETE /v1_1/demo/resources?asset_ids");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void missingConfigurationFailsClosedWithoutNetworkAccess() {
        var storage =
                new CloudinaryArticleImageStorage(
                        new CloudinaryProperties(
                                "",
                                "",
                                "",
                                "techverse/articles",
                                URI.create("https://api.cloudinary.com"),
                                false),
                        new ObjectMapper());
        assertThat(storage.configured()).isFalse();
        assertThatThrownBy(() -> storage.find("anything")).isInstanceOf(CustomException.class);
    }
}
