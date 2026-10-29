package com.techverse.server.user;

import static org.assertj.core.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import com.techverse.server.exception.*;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.service.AvatarStorage;
import com.techverse.server.service.impl.CloudinaryAvatarStorage;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

class CloudinaryAvatarStorageTest {
    @Test
    void multipartUploadsNeverOverwriteAndCleanupProtectsSharedDefaultAndOtherOwners()
            throws Exception {
        UUID owner = UUID.randomUUID();
        String id = "techverse/avatars/" + owner + "/" + UUID.randomUUID();
        String url = "https://res.cloudinary.com/demo/image/upload/v1/" + id + ".png";
        List<String> calls = new ArrayList<>();
        var body = new AtomicReference<String>();
        var auth = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/v1_1/demo/",
                exchange -> {
                    calls.add(
                            exchange.getRequestMethod()
                                    + " "
                                    + URLDecoder.decode(
                                            exchange.getRequestURI().toString(),
                                            StandardCharsets.UTF_8));
                    String json;
                    if (exchange.getRequestMethod().equals("POST")) {
                        auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
                        body.set(
                                new String(
                                        exchange.getRequestBody().readAllBytes(),
                                        StandardCharsets.ISO_8859_1));
                        json = response(id, url);
                    } else if (exchange.getRequestMethod().equals("GET")) json = response(id, url);
                    else json = "{\"deleted\":{\"" + id + "\":\"deleted\"}}";
                    byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, bytes.length);
                    exchange.getResponseBody().write(bytes);
                    exchange.close();
                });
        server.start();
        try {
            var storage = storage(server);
            assertThat(storage.upload(id, UserAvatarIntegrationTest.png()).url()).isEqualTo(url);
            assertThat(auth.get()).isEqualTo("Basic a2V5OnNlY3JldA==");
            assertThat(body.get())
                    .contains(id, "name=\"overwrite\"\r\n\r\nfalse", "managed=techverse_avatar");
            storage.deleteOwned(UUID.randomUUID(), url);
            storage.deleteOwned(
                    owner,
                    "https://res.cloudinary.com/demo/image/upload/v1/"
                            + AvatarStorage.DEFAULT_ID
                            + ".png");
            storage.deleteOwned(owner, "https://evil.example/avatar.png");
            assertThat(calls).hasSize(1);
            storage.deleteOwned(owner, url);
            assertThat(calls).hasSize(3);
            assertThat(calls.getLast())
                    .contains("DELETE", "asset_ids[]=immutable-one")
                    .doesNotContain("public_ids");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void malformedProviderJsonIsAnUpstreamErrorNotAnInternalServerError() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    exchange.getRequestBody().readAllBytes();
                    byte[] bytes = "not-json".getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, bytes.length);
                    exchange.getResponseBody().write(bytes);
                    exchange.close();
                });
        server.start();
        try {
            assertThatThrownBy(
                            () -> storage(server).upload(AvatarStorage.DEFAULT_ID, new byte[] {1}))
                    .isInstanceOfSatisfying(
                            CustomException.class,
                            e ->
                                    assertThat(e.getErrorCode())
                                            .isEqualTo(ErrorCode.AVATAR_UPLOAD_FAILED));
        } finally {
            server.stop(0);
        }
    }

    CloudinaryAvatarStorage storage(HttpServer server) {
        return new CloudinaryAvatarStorage(
                new CloudinaryProperties(
                        "demo",
                        "key",
                        "secret",
                        "techverse/articles",
                        URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
                        false),
                new ObjectMapper());
    }

    String response(String id, String url) {
        return "{\"asset_id\":\"immutable-one\",\"public_id\":\""
                + id
                + "\",\"version\":1,\"secure_url\":\""
                + url
                + "\",\"context\":{\"custom\":{\"managed\":\"techverse_avatar\"}}}";
    }
}
