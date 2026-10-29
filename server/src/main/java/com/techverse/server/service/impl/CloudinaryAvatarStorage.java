package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.AvatarAsset;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.service.AvatarStorage;

import org.springframework.stereotype.Service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

/** Separate namespace/lifecycle from article images; never overwrites an existing asset. */
@Service
public class CloudinaryAvatarStorage implements AvatarStorage {
    private final CloudinaryProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient http =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(4))
                    .followRedirects(HttpClient.Redirect.NEVER)
                    .build();

    public CloudinaryAvatarStorage(CloudinaryProperties properties, ObjectMapper mapper) {
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    public boolean configured() {
        return !properties.cloudName().isBlank()
                && !properties.apiKey().isBlank()
                && !properties.apiSecret().isBlank();
    }

    @Override
    public AvatarAsset upload(String publicId, byte[] png) {
        checkId(publicId);
        String boundary = "avatar-" + UUID.randomUUID();
        try {
            var body = new ByteArrayOutputStream();
            for (var field :
                    Map.of(
                                    "public_id",
                                    publicId,
                                    "overwrite",
                                    "false",
                                    "context",
                                    "managed=techverse_avatar",
                                    "tags",
                                    "techverse_avatar")
                            .entrySet()) {
                body.write(
                        ("--"
                                        + boundary
                                        + "\r\nContent-Disposition: form-data; name=\""
                                        + field.getKey()
                                        + "\"\r\n\r\n"
                                        + field.getValue()
                                        + "\r\n")
                                .getBytes(StandardCharsets.UTF_8));
            }
            body.write(
                    ("--"
                                    + boundary
                                    + "\r\n"
                                    + "Content-Disposition: form-data; name=\"file\";"
                                    + " filename=\"avatar.png\"\r\n"
                                    + "Content-Type: image/png\r\n\r\n")
                            .getBytes(StandardCharsets.UTF_8));
            body.write(png);
            body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            var response =
                    send(
                            request("/image/upload")
                                    .header(
                                            "Content-Type",
                                            "multipart/form-data; boundary=" + boundary)
                                    .POST(
                                            HttpRequest.BodyPublishers.ofByteArray(
                                                    body.toByteArray()))
                                    .build());
            // The shared default may already have been provisioned by another process.
            if (response.statusCode() == 409 && DEFAULT_ID.equals(publicId)) return find(publicId);
            requireSuccess(response);
            return asset(mapper.readTree(response.body()), publicId);
        } catch (CustomException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new CustomException(ErrorCode.AVATAR_UPLOAD_FAILED);
        }
    }

    @Override
    public void deleteOwned(UUID ownerId, String url) {
        String prefix = "https://res.cloudinary.com/" + properties.cloudName() + "/image/upload/";
        if (url == null || !url.startsWith(prefix)) return;
        String path = url.substring(prefix.length());
        // Only exact canonical URLs produced by this adapter, never transforms/external/shared
        // images.
        if (!path.matches("v[0-9]+/techverse/avatars/" + ownerId + "/[a-f0-9-]{36}\\.png")) return;
        String id = path.substring(path.indexOf('/') + 1, path.length() - 4);
        AvatarAsset existing = find(id);
        if (existing == null || !url.equals(existing.url())) return;
        var response =
                send(
                        request(
                                        "/resources?asset_ids%5B%5D="
                                                + encode(existing.assetId())
                                                + "&invalidate=true")
                                .DELETE()
                                .build());
        requireSuccess(response);
    }

    private AvatarAsset find(String id) {
        var response = send(request("/resources/image/upload/" + encode(id)).GET().build());
        if (response.statusCode() == 404) return null;
        requireSuccess(response);
        try {
            return asset(mapper.readTree(response.body()), id);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new CustomException(ErrorCode.AVATAR_UPLOAD_FAILED);
        }
    }

    private AvatarAsset asset(JsonNode node, String expectedId) {
        String url = node.path("secure_url").asText();
        String id = node.path("asset_id").asText();
        String canonical =
                "https://res.cloudinary.com/"
                        + properties.cloudName()
                        + "/image/upload/v"
                        + node.path("version").asLong()
                        + "/"
                        + expectedId
                        + ".png";
        if (!expectedId.equals(node.path("public_id").asText())
                || !url.equals(canonical)
                || !id.matches("[A-Za-z0-9_-]+")
                || !"techverse_avatar".equals(node.at("/context/custom/managed").asText())) {
            throw new CustomException(ErrorCode.AVATAR_UPLOAD_FAILED);
        }
        return AvatarAsset.builder().publicId(expectedId).assetId(id).url(url).build();
    }

    private HttpRequest.Builder request(String path) {
        if (!configured() || !properties.cloudName().matches("[A-Za-z0-9_-]+"))
            throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
        String basic =
                Base64.getEncoder()
                        .encodeToString(
                                (properties.apiKey() + ":" + properties.apiSecret())
                                        .getBytes(StandardCharsets.UTF_8));
        return HttpRequest.newBuilder(
                        URI.create(properties.apiBase() + "/v1_1/" + properties.cloudName() + path))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", "Basic " + basic)
                .header("Accept", "application/json");
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
        } catch (IOException e) {
            throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
        }
    }

    private void requireSuccess(HttpResponse<?> response) {
        if (response.statusCode() == 429 || response.statusCode() >= 500)
            throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
        if (response.statusCode() < 200 || response.statusCode() >= 300)
            throw new CustomException(ErrorCode.AVATAR_UPLOAD_FAILED);
    }

    private void checkId(String id) {
        if (!DEFAULT_ID.equals(id) && !id.matches("techverse/avatars/[a-f0-9-]{36}/[a-f0-9-]{36}"))
            throw new CustomException(ErrorCode.AVATAR_IMAGE_INVALID);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
