package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.*;
import com.techverse.server.exception.*;
import com.techverse.server.properties.CloudinaryProperties;
import com.techverse.server.service.ArticleImageStorage;

import org.springframework.stereotype.Service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

@Service
public class CloudinaryArticleImageStorage implements ArticleImageStorage {
    private final CloudinaryProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient http =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(4))
                    .followRedirects(HttpClient.Redirect.NEVER)
                    .build();

    public CloudinaryArticleImageStorage(CloudinaryProperties properties, ObjectMapper mapper) {
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
    public Optional<ArticleImageAsset> find(String publicId) {
        checkConfigured();
        checkPublicId(publicId);
        var result = send(request("/resources/image/upload/" + encode(publicId)).GET().build());
        if (result.statusCode() == 404) return Optional.empty();
        requireSuccess(result);
        return Optional.of(asset(result.body()));
    }

    @Override
    public ArticleImageAsset upload(
            String publicId, UUID owner, UUID article, DecodedArticleImage image) {
        checkConfigured();
        checkPublicId(publicId);
        String boundary = "techverse-" + UUID.randomUUID();
        String context =
                "managed=techverse_article|owner="
                        + owner
                        + "|article="
                        + article
                        + "|fingerprint="
                        + image.fingerprint();
        byte[] multipart;
        try {
            var out = new ByteArrayOutputStream();
            for (var field :
                    Map.of(
                                    "public_id",
                                    publicId,
                                    "overwrite",
                                    "false",
                                    "context",
                                    context,
                                    "tags",
                                    "techverse_article")
                            .entrySet()) {
                out.write(
                        ("--"
                                        + boundary
                                        + "\r\nContent-Disposition: form-data; name=\""
                                        + field.getKey()
                                        + "\"\r\n\r\n"
                                        + field.getValue()
                                        + "\r\n")
                                .getBytes(StandardCharsets.UTF_8));
            }
            out.write(
                    ("--"
                                    + boundary
                                    + "\r\n"
                                    + "Content-Disposition: form-data; name=\"file\";"
                                    + " filename=\"image.png\"\r\n"
                                    + "Content-Type: image/png\r\n\r\n")
                            .getBytes(StandardCharsets.UTF_8));
            out.write(image.bytes());
            out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            multipart = out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        var response =
                send(
                        request("/image/upload")
                                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                                .POST(HttpRequest.BodyPublishers.ofByteArray(multipart))
                                .build());
        // Cloudinary may report an existing overwrite=false asset or a conflict.
        if (response.statusCode() == 409)
            return find(publicId)
                    .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED));
        requireSuccess(response);
        return asset(response.body());
    }

    @Override
    public AssetPage list(String cursor) {
        checkConfigured();
        String path =
                "/resources/image/upload?prefix="
                        + encode(properties.folder() + "/")
                        + "&context=true&max_results=100";
        if (cursor != null) path += "&next_cursor=" + encode(cursor);
        var response = send(request(path).GET().build());
        requireSuccess(response);
        try {
            JsonNode body = mapper.readTree(response.body());
            var assets = new ArrayList<ArticleImageAsset>();
            for (var node : body.path("resources")) {
                if (!"techverse_article".equals(node.at("/context/custom/managed").asText()))
                    continue;
                try {
                    assets.add(asset(node));
                } catch (CustomException ignored) {
                    /* Never delete unknown/unmanaged assets. */
                }
            }
            return new AssetPage(
                    assets,
                    body.path("next_cursor").isTextual()
                            ? body.path("next_cursor").asText()
                            : null);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
        }
    }

    @Override
    public ArticleImageAsset renew(ArticleImageAsset asset, Instant touchedAt) {
        return addContext(asset, "touched_at=" + touchedAt);
    }

    @Override
    public ArticleImageAsset retire(ArticleImageAsset asset) {
        return addContext(asset, "retiring=true");
    }

    private ArticleImageAsset addContext(ArticleImageAsset asset, String context) {
        checkConfigured();
        checkPublicId(asset.publicId());
        // 'add' merges keys: a late touch can never clear the one-way retirement marker.
        var response =
                send(
                        request("/image/context")
                                .header("Content-Type", "application/x-www-form-urlencoded")
                                .POST(
                                        HttpRequest.BodyPublishers.ofString(
                                                "command=add&public_ids%5B%5D="
                                                        + encode(asset.publicId())
                                                        + "&context="
                                                        + encode(context)))
                                .build());
        requireSuccess(response);
        var updated =
                find(asset.publicId())
                        .orElseThrow(() -> new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID));
        if (!Objects.equals(asset.assetId(), updated.assetId()))
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
        if (context.startsWith("retiring=") && !updated.retiring())
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        if (context.startsWith("touched_at=")
                && (updated.touchedAt() == null
                        || updated.touchedAt().isBefore(Instant.parse(context.substring(11)))))
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        return updated;
    }

    @Override
    public void delete(String assetId) {
        checkConfigured();
        if (assetId == null || !assetId.matches("[A-Za-z0-9_-]+"))
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
        var response =
                send(
                        request(
                                        "/resources?asset_ids%5B%5D="
                                                + encode(assetId)
                                                + "&invalidate=true")
                                .DELETE()
                                .build());
        requireSuccess(response);
        try {
            var states = mapper.readTree(response.body()).path("deleted");
            // Provider responses can key this map by public ID. Exactly one ID was requested.
            if (states.size() != 1)
                throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
            String state = states.iterator().next().asText();
            if (!state.equals("deleted") && !state.equals("not_found"))
                throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
        }
    }

    private HttpRequest.Builder request(String path) {
        String cloud = properties.cloudName();
        if (!cloud.matches("[A-Za-z0-9_-]+"))
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        String basic =
                Base64.getEncoder()
                        .encodeToString(
                                (properties.apiKey() + ":" + properties.apiSecret())
                                        .getBytes(StandardCharsets.UTF_8));
        return HttpRequest.newBuilder(URI.create(properties.apiBase() + "/v1_1/" + cloud + path))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", "Basic " + basic)
                .header("Accept", "application/json");
    }

    private HttpResponse<String> send(HttpRequest request) {
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        } catch (IOException e) {
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        }
    }

    private void requireSuccess(HttpResponse<?> result) {
        if (result.statusCode() == 429 || result.statusCode() >= 500)
            throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
        if (result.statusCode() < 200 || result.statusCode() >= 300)
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
    }

    private ArticleImageAsset asset(String json) {
        try {
            return asset(mapper.readTree(json));
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
        }
    }

    private ArticleImageAsset asset(JsonNode node) {
        try {
            JsonNode custom = node.at("/context/custom");
            if (!custom.path("managed").asText().equals("techverse_article"))
                throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
            return ArticleImageAsset.builder()
                    .assetId(node.path("asset_id").asText())
                    .publicId(node.path("public_id").asText())
                    .url(node.path("secure_url").asText())
                    .ownerId(UUID.fromString(custom.path("owner").asText()))
                    .articleId(UUID.fromString(custom.path("article").asText()))
                    .fingerprint(custom.path("fingerprint").asText())
                    .width(node.path("width").asInt())
                    .height(node.path("height").asInt())
                    .createdAt(Instant.parse(node.path("created_at").asText()))
                    .touchedAt(
                            custom.path("touched_at").isTextual()
                                    ? Instant.parse(custom.path("touched_at").asText())
                                    : null)
                    .retiring("true".equals(custom.path("retiring").asText()))
                    .build();
        } catch (Exception e) {
            throw new CustomException(ErrorCode.ARTICLE_IMAGE_UPLOAD_FAILED);
        }
    }

    private String encode(String text) {
        return URLEncoder.encode(text, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private void checkConfigured() {
        if (!configured()) throw new CustomException(ErrorCode.ARTICLE_STORAGE_UNAVAILABLE);
    }

    private void checkPublicId(String id) {
        if (!id.startsWith(properties.folder() + "/")
                || !id.matches("[A-Za-z0-9_/-]+")
                || id.contains("..")) throw new CustomException(ErrorCode.ARTICLE_IMAGE_INVALID);
    }
}
