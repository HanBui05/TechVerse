package com.techverse.server.controller;

import com.techverse.server.dto.request.*;
import com.techverse.server.dto.response.*;
import com.techverse.server.service.AuthorArticleService;
import com.techverse.server.service.impl.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springdoc.core.annotations.ParameterObject;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/author/articles")
@RequiredArgsConstructor
@Tag(
        name = "Author Articles",
        description = "Own drafts, Markdown import and submission for moderation")
public class AuthorArticleController {
    private final AuthorArticleService service;
    private final ArticleContentService content;
    private final ArticleAccessService access;
    private final ArticleRateLimitService limits;
    private final ArticleImageService images;
    private final PlatformTransactionManager transactionManager;

    @GetMapping("/options")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Get independently paged active Topics and Tags")
    public ApiResponse<ArticleOptionsResponse> options(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject @ModelAttribute ArticleOptionsFilter f) {
        return ok("Article options retrieved", service.options(actor(jwt), f));
    }

    @PostMapping("/import")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Import UTF-8 .md/.txt (1 MiB); does not save an article")
    public ApiResponse<ArticleImportResponse> importFile(
            @AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file) {
        new TransactionTemplate(transactionManager)
                .executeWithoutResult(s -> access.lockWriter(actor(jwt)));
        limits.check(actor(jwt), false);
        return ok("Content imported; save the article separately", content.importFile(file));
    }

    @PostMapping
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Create draft or submit; retry with the same UUID Idempotency-Key")
    public ResponseEntity<ApiResponse<ArticleResponse>> create(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader("Idempotency-Key") UUID key,
            @Valid @RequestBody ArticleWriteRequest request) {
        return ResponseEntity.status(201)
                .body(
                        ApiResponse.<ArticleResponse>builder()
                                .status(201)
                                .message("Article created successfully")
                                .data(service.create(actor(jwt), key, request))
                                .build());
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List own articles; suspended Authors retain read access")
    public ApiResponse<PageResponse<ArticleSummaryResponse>> list(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @ParameterObject @ModelAttribute ArticleFilter f) {
        return ok("Articles retrieved", service.list(actor(jwt), f));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ArticleResponse> detail(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Article retrieved", service.detail(actor(jwt), id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Partial draft update with SAVE/SUBMIT; no version field")
    public ApiResponse<ArticleResponse> update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ArticleWriteRequest request) {
        return ok("Article updated successfully", service.update(actor(jwt), id, request));
    }

    @PostMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Withdraw a pending revision back to DRAFT; public snapshot unchanged")
    public ApiResponse<ArticleResponse> withdraw(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Article withdrawn", service.withdraw(actor(jwt), id));
    }

    @PostMapping("/{id}/discard")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Discard an unsubmitted revision and restore the published snapshot")
    public ApiResponse<ArticleResponse> discard(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ok("Revision discarded", service.discard(actor(jwt), id));
    }

    @PatchMapping("/{id}/publication")
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(summary = "Author HIDE/UNHIDE of the published snapshot")
    public ApiResponse<ArticleResponse> publication(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ArticlePublicationRequest request) {
        return ok("Publication updated", service.publication(actor(jwt), id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    @Operation(
            summary =
                    "Hard-delete a never-published draft or soft-delete a published article;"
                            + " suspended Authors may delete")
    public ApiResponse<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(actor(jwt), id);
        return ok("Article deleted", null);
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Moderation/publication history, newest first; only page/size apply")
    public ApiResponse<PageResponse<ArticleModerationHistoryResponse>> history(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @ParameterObject @ModelAttribute ArticleFilter f) {
        return ok(
                "Article history retrieved",
                service.history(actor(jwt), id, f.getPage(), f.getSize()));
    }

    @PostMapping(value = "/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('AUTHOR')")
    @Operation(
            summary =
                    "Upload a draft image (JPEG/PNG/WebP, 5 MiB); reuse UUID Upload-Key on retries")
    public ApiResponse<ArticleImageResponse> upload(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestHeader(value = "Upload-Key", required = false) UUID key,
            @RequestPart("file") MultipartFile file) {
        return ok(
                "Image uploaded; save the article separately",
                images.upload(actor(jwt), id, key == null ? UUID.randomUUID() : key, file));
    }

    private UUID actor(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().status(200).message(message).data(data).build();
    }
}
