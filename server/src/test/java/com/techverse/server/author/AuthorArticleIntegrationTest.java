package com.techverse.server.author;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.dto.internal.ArticleCreationReceipt;
import com.techverse.server.dto.internal.ArticleImageAsset;
import com.techverse.server.dto.internal.DecodedArticleImage;
import com.techverse.server.entity.User;
import com.techverse.server.repository.ArticleCreationRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.ArticleImageStorage;
import com.techverse.server.service.impl.ArticleImageCleanupService;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.concurrent.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthorArticleIntegrationTest {
    static final String ROOT = "/api/v1/author/articles";

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Container
    @ServiceConnection(name = "redis")
    static GenericContainer<?> redis =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @MockitoBean ArticleImageStorage imageStorage;
    @Autowired ArticleImageCleanupService cleanup;
    @MockitoSpyBean ArticleCreationRepository receipts;
    @Autowired org.springframework.data.redis.core.StringRedisTemplate redisTemplate;
    final Map<String, ArticleImageAsset> cloud = new ConcurrentHashMap<>();
    UUID author, other, learner, topic, tag;
    String token, otherToken, learnerToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute(
                "INSERT INTO techverse.roles(name) VALUES"
                        + " ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        author = user("author@example.com", true);
        other = user("other@example.com", true);
        learner = user("learner@example.com", false);
        token = login("author@example.com");
        otherToken = login("other@example.com");
        learnerToken = login("learner@example.com");
        topic =
                jdbc.queryForObject(
                        "INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id",
                        UUID.class);
        tag =
                jdbc.queryForObject(
                        "INSERT INTO techverse.tags(name) VALUES ('Java') RETURNING id",
                        UUID.class);
        cloud.clear();
        when(imageStorage.configured()).thenReturn(true);
        when(imageStorage.find(anyString()))
                .thenAnswer(i -> Optional.ofNullable(cloud.get(i.getArgument(0))));
        when(imageStorage.upload(anyString(), any(), any(), any()))
                .thenAnswer(
                        i -> {
                            String publicId = i.getArgument(0);
                            UUID owner = i.getArgument(1), article = i.getArgument(2);
                            DecodedArticleImage image = i.getArgument(3);
                            return cloud.computeIfAbsent(
                                    publicId,
                                    k ->
                                            ArticleImageAsset.builder()
                                                    .assetId(UUID.randomUUID().toString())
                                                    .publicId(k)
                                                    .url(
                                                            "https://res.cloudinary.com/test/image/upload/v1/"
                                                                    + k
                                                                    + ".png")
                                                    .ownerId(owner)
                                                    .articleId(article)
                                                    .fingerprint(image.fingerprint())
                                                    .width(image.width())
                                                    .height(image.height())
                                                    .createdAt(java.time.Instant.now())
                                                    .build());
                        });
        when(imageStorage.list(any()))
                .thenAnswer(
                        i ->
                                new ArticleImageStorage.AssetPage(
                                        new ArrayList<>(cloud.values()), null));
        when(imageStorage.renew(any(), any()))
                .thenAnswer(
                        i -> {
                            ArticleImageAsset asset = i.getArgument(0);
                            var renewed = asset.toBuilder().touchedAt(i.getArgument(1)).build();
                            cloud.put(asset.publicId(), renewed);
                            return renewed;
                        });
        when(imageStorage.retire(any()))
                .thenAnswer(
                        i -> {
                            ArticleImageAsset asset = i.getArgument(0);
                            var retired = asset.toBuilder().retiring(true).build();
                            cloud.put(asset.publicId(), retired);
                            return retired;
                        });
        doAnswer(
                        i -> {
                            deleteAsset(i.getArgument(0));
                            return null;
                        })
                .when(imageStorage)
                .delete(anyString());
    }

    @Test
    void draftDefaultsAuditAndPartialUpdates() throws Exception {
        var result =
                create(
                                UUID.randomUUID(),
                                Map.of("title", "  Intro  ", "topicId", topic, "action", "SAVE"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.data.status").value("DRAFT"))
                        .andExpect(jsonPath("$.data.title").value("Intro"))
                        .andExpect(jsonPath("$.data.summary").value(""))
                        .andExpect(jsonPath("$.data.createdBy").value(author.toString()))
                        .andExpect(jsonPath("$.data.version").doesNotExist())
                        .andReturn();
        UUID id = id(result);
        update(
                        id,
                        Map.of(
                                "action",
                                "SAVE",
                                "summary",
                                "Description",
                                "content",
                                "```java\n  int i = 1;\n```",
                                "tagIds",
                                List.of(tag)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tags.length()").value(1));
        update(id, Map.of("action", "SAVE", "title", "Changed", "tagIds", List.of()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.summary").value("Description"))
                .andExpect(jsonPath("$.data.content").value("```java\n  int i = 1;\n```"))
                .andExpect(jsonPath("$.data.tags.length()").value(0));
    }

    @Test
    void invalidBodiesAndReadOnlyFieldsAreRejected() throws Exception {
        for (Object body :
                List.of(
                        Map.of("action", "SAVE", "topicId", topic),
                        Map.of("action", "NOPE", "title", "Title", "topicId", topic),
                        Map.of("action", "SAVE", "title", " ", "topicId", topic),
                        Map.of("action", "SAVE", "title", "x".repeat(256), "topicId", topic),
                        Map.of(
                                "action",
                                "SAVE",
                                "title",
                                "Title",
                                "topicId",
                                topic,
                                "authorId",
                                other),
                        Map.of(
                                "action",
                                "SAVE",
                                "title",
                                "Title",
                                "topicId",
                                topic,
                                "tagIds",
                                List.of(tag, tag)))) {
            create(UUID.randomUUID(), body).andExpect(status().isBadRequest());
        }
        UUID id = draft();
        update(id, Map.of("action", "SAVE")).andExpect(status().isBadRequest());
        mvc.perform(
                        patch(ROOT + "/" + id)
                                .header("Authorization", bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"action\":\"SAVE\",\"content\":null}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submissionValidatesFinalObjectAndIsAtomic() throws Exception {
        UUID id = draft();
        update(id, Map.of("action", "SUBMIT", "title", "Must rollback"))
                .andExpect(status().isBadRequest());
        detail(token, id)
                .andExpect(jsonPath("$.data.title").value("Title"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"));
        update(
                        id,
                        Map.of(
                                "action",
                                "SAVE",
                                "summary",
                                "Summary",
                                "content",
                                "# Content",
                                "tagIds",
                                List.of(tag)))
                .andExpect(status().isOk());
        update(id, Map.of("action", "SUBMIT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
        update(id, Map.of("action", "SAVE", "title", "Illegal")).andExpect(status().isConflict());
        update(id, Map.of("action", "SUBMIT")).andExpect(status().isConflict());
    }

    @Test
    void inactiveAssignmentsCanRemainInDraftButPreventSubmission() throws Exception {
        UUID id =
                id(
                        create(UUID.randomUUID(), full("SAVE"))
                                .andExpect(status().isCreated())
                                .andReturn());
        jdbc.update("UPDATE techverse.topics SET is_active=false WHERE id=?", topic);
        jdbc.update("UPDATE techverse.tags SET is_active=false WHERE id=?", tag);
        update(id, Map.of("action", "SAVE", "title", "Still draft")).andExpect(status().isOk());
        update(id, Map.of("action", "SUBMIT")).andExpect(status().isConflict());
        create(UUID.randomUUID(), full("SAVE")).andExpect(status().isConflict());
        mvc.perform(get(ROOT + "/options").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.topics.totalElements").value(0))
                .andExpect(jsonPath("$.data.tags.totalElements").value(0));
    }

    @Test
    void authenticationOwnerIsolationAndSuspensionAreEnforced() throws Exception {
        UUID id = draft();
        mvc.perform(get(ROOT)).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOT).header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
        createWith(learnerToken, UUID.randomUUID(), full("SAVE")).andExpect(status().isForbidden());
        detail(otherToken, id).andExpect(status().isNotFound());
        mvc.perform(
                        patch(ROOT + "/" + id)
                                .header("Authorization", bearer(otherToken))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        mapper.writeValueAsString(
                                                Map.of("action", "SAVE", "title", "Stolen"))))
                .andExpect(status().isNotFound());
        jdbc.update(
                "UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE user_id=?", author);
        jdbc.update(
                "DELETE FROM techverse.user_roles WHERE user_id=? AND role_id=(SELECT id FROM"
                        + " techverse.roles WHERE name='AUTHOR')",
                author);
        detail(token, id).andExpect(status().isOk());
        update(id, Map.of("action", "SAVE", "title", "Blocked")).andExpect(status().isForbidden());
    }

    @Test
    void listIsScopedFilteredPagedAndDoesNotReturnContent() throws Exception {
        create(UUID.randomUUID(), full("SAVE")).andExpect(status().isCreated());
        createWith(otherToken, UUID.randomUUID(), full("SAVE")).andExpect(status().isCreated());
        mvc.perform(
                        get(ROOT)
                                .header("Authorization", bearer(token))
                                .param("tagId", tag.toString())
                                .param("keyword", "tit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].content").doesNotExist());
        mvc.perform(get(ROOT).header("Authorization", bearer(token)).param("keyword", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
        for (String query : List.of("size=101", "page=-1", "status=APPROVE", "sortBy=content")) {
            mvc.perform(get(ROOT + "?" + query).header("Authorization", bearer(token)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void idempotencyReplaysAndRejectsChangedPayload() throws Exception {
        UUID key = UUID.randomUUID();
        var first = create(key, full("SAVE")).andExpect(status().isCreated()).andReturn();
        var retry = create(key, full("SAVE")).andExpect(status().isCreated()).andReturn();
        assertThat(id(retry)).isEqualTo(id(first));
        create(key, full("SUBMIT")).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.articles", Integer.class))
                .isEqualTo(1);
        mvc.perform(
                        post(ROOT)
                                .header("Authorization", bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(mapper.writeValueAsString(full("SAVE"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void concurrentCreateHasOneRowAndConcurrentSubmitOneWinner() throws Exception {
        UUID key = UUID.randomUUID();
        var creations = parallel(() -> create(key, full("SAVE")).andReturn());
        assertThat(creations.stream().map(r -> r.getResponse().getStatus()).toList())
                .containsOnly(201);
        assertThat(id(creations.get(0))).isEqualTo(id(creations.get(1)));
        UUID id = id(creations.get(0));
        var submissions = parallel(() -> update(id, Map.of("action", "SUBMIT")).andReturn());
        assertThat(submissions.stream().map(r -> r.getResponse().getStatus()).toList())
                .containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.articles", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void pendingReceiptAfterCommitReplaysOriginalResponseEvenAfterLaterEdits() throws Exception {
        UUID key = UUID.randomUUID();
        UUID id = id(create(key, full("SAVE")).andExpect(status().isCreated()).andReturn());
        var receipt = receipts.find(author, key);
        receipts.save(
                author,
                key,
                ArticleCreationReceipt.builder()
                        .fingerprint(receipt.fingerprint())
                        .articleId(id)
                        .response(receipt.response())
                        .complete(false)
                        .build());
        update(id, Map.of("action", "SAVE", "title", "Later edit")).andExpect(status().isOk());
        create(key, full("SAVE"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(id.toString()))
                .andExpect(jsonPath("$.data.title").value("Title"));
        detail(token, id).andExpect(jsonPath("$.data.title").value("Later edit"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.articles", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void receiptFailureBeforeCommitRollsBackAndRetryCanCreate() throws Exception {
        UUID key = UUID.randomUUID();
        doThrow(
                        new com.techverse.server.exception.CustomException(
                                com.techverse.server.exception.ErrorCode
                                        .ARTICLE_STORAGE_UNAVAILABLE))
                .when(receipts)
                .save(eq(author), eq(key), any());
        create(key, full("SAVE")).andExpect(status().isServiceUnavailable());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.articles", Integer.class))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM techverse.article_tags", Integer.class))
                .isZero();
        doCallRealMethod().when(receipts).save(eq(author), eq(key), any());
        create(key, full("SAVE")).andExpect(status().isCreated());
    }

    @Test
    void receiptDoneFailureDoesNotMisreportACommittedCreation() throws Exception {
        UUID key = UUID.randomUUID();
        doAnswer(
                        i -> {
                            ArticleCreationReceipt receipt = i.getArgument(2);
                            if (receipt.complete())
                                throw new com.techverse.server.exception.CustomException(
                                        com.techverse.server.exception.ErrorCode
                                                .ARTICLE_STORAGE_UNAVAILABLE);
                            return i.callRealMethod();
                        })
                .when(receipts)
                .save(eq(author), eq(key), any());
        UUID id = id(create(key, full("SAVE")).andExpect(status().isCreated()).andReturn());
        assertThat(receipts.find(author, key).complete()).isFalse();
        create(key, full("SAVE"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(id.toString()));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.articles", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void importsAreRateLimitedAndCorsAllowsCreationAndUploadKeys() throws Exception {
        redisTemplate
                .opsForValue()
                .set("article:rate:import:" + author, "60", java.time.Duration.ofHours(1));
        mvc.perform(
                        multipart(ROOT + "/import")
                                .file(
                                        new MockMultipartFile(
                                                "file",
                                                "readme.md",
                                                "text/plain",
                                                "text".getBytes()))
                                .header("Authorization", bearer(token)))
                .andExpect(status().isTooManyRequests());
        mvc.perform(
                        options(ROOT)
                                .header("Origin", "http://localhost:3000")
                                .header("Access-Control-Request-Method", "POST")
                                .header(
                                        "Access-Control-Request-Headers",
                                        "Authorization,Content-Type,Idempotency-Key,Upload-Key"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
    }

    @Test
    void resubmissionPreservesReviewNoteAndPublishedArticlesAreReadOnly() throws Exception {
        UUID id =
                id(
                        create(UUID.randomUUID(), full("SAVE"))
                                .andExpect(status().isCreated())
                                .andReturn());
        jdbc.update(
                "UPDATE techverse.articles SET status='CHANGES_REQUESTED',moderation_note='Add"
                        + " examples' WHERE id=?",
                id);
        update(id, Map.of("action", "SAVE", "title", "Revised"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CHANGES_REQUESTED"));
        update(id, Map.of("action", "SUBMIT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.moderationNote").value("Add examples"));
        jdbc.update(
                "UPDATE techverse.articles SET status='PUBLISHED',published_at=now() WHERE id=?",
                id);
        update(id, Map.of("action", "SAVE", "title", "Not allowed"))
                .andExpect(status().isConflict());
        detail(token, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Revised"));
    }

    @Test
    void importReturnsContentOnlyAndRejectsInvalidRequests() throws Exception {
        mvc.perform(
                        multipart(ROOT + "/import")
                                .file(
                                        new MockMultipartFile(
                                                "file",
                                                "readme.md",
                                                "text/plain",
                                                "# Imported\n".getBytes()))
                                .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content").value("# Imported\n"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.articles", Integer.class))
                .isZero();
        mvc.perform(
                        multipart(ROOT + "/import")
                                .file(
                                        new MockMultipartFile(
                                                "file", "bad.exe", "text/plain", "text".getBytes()))
                                .header("Authorization", bearer(token)))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(multipart(ROOT + "/import").header("Authorization", bearer(token)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRetryOwnershipAndMarkdownReferencesAreEnforced() throws Exception {
        UUID id = draft(), key = UUID.randomUUID();
        var first = upload(token, id, key, png(2)).andExpect(status().isOk()).andReturn();
        String url =
                mapper.readTree(first.getResponse().getContentAsString()).at("/data/url").asText();
        upload(token, id, key, png(2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.url").value(url));
        upload(token, id, key, png(3)).andExpect(status().isConflict());
        assertThat(cloud).hasSize(1);
        upload(otherToken, id, UUID.randomUUID(), png(2)).andExpect(status().isNotFound());
        update(
                        id,
                        Map.of(
                                "action",
                                "SAVE",
                                "coverImageUrl",
                                url,
                                "content",
                                "![image](" + url + ")"))
                .andExpect(status().isOk());
        UUID otherDraft = draft();
        update(otherDraft, Map.of("action", "SAVE", "coverImageUrl", url))
                .andExpect(status().isBadRequest());
        update(id, Map.of("action", "SAVE", "content", "![evil](https://example.com/evil.png)"))
                .andExpect(status().isBadRequest());
        detail(token, id).andExpect(jsonPath("$.data.content").value("![image](" + url + ")"));
    }

    @Test
    void providerFailureAndStateChangeDuringUploadDoNotChangeTheArticle() throws Exception {
        UUID id = draft();
        doThrow(
                        new com.techverse.server.exception.CustomException(
                                com.techverse.server.exception.ErrorCode
                                        .ARTICLE_STORAGE_UNAVAILABLE))
                .when(imageStorage)
                .upload(anyString(), any(), any(), any());
        upload(token, id, UUID.randomUUID(), png(2)).andExpect(status().isServiceUnavailable());
        doAnswer(
                        i -> {
                            jdbc.update(
                                    "UPDATE techverse.author_profiles SET status='SUSPENDED' WHERE"
                                            + " user_id=?",
                                    author);
                            return ArticleImageAsset.builder()
                                    .assetId(UUID.randomUUID().toString())
                                    .publicId(i.getArgument(0))
                                    .url(
                                            "https://res.cloudinary.com/test/image/upload/v1/"
                                                    + i.getArgument(0)
                                                    + ".png")
                                    .ownerId(author)
                                    .articleId(id)
                                    .fingerprint(
                                            ((DecodedArticleImage) i.getArgument(3)).fingerprint())
                                    .width(2)
                                    .height(2)
                                    .createdAt(java.time.Instant.now())
                                    .build();
                        })
                .when(imageStorage)
                .upload(anyString(), any(), any(), any());
        upload(token, id, UUID.randomUUID(), png(2)).andExpect(status().isForbidden());
        assertThat(
                        jdbc.queryForObject(
                                "SELECT cover_image_url FROM techverse.articles WHERE id=?",
                                String.class,
                                id))
                .isNull();
    }

    @Test
    void cleanupKeepsReferencesAndGivesDetachedImagesAGracePeriod() throws Exception {
        UUID id = draft();
        var uploaded =
                upload(token, id, UUID.randomUUID(), png(2)).andExpect(status().isOk()).andReturn();
        String url =
                mapper.readTree(uploaded.getResponse().getContentAsString())
                        .at("/data/url")
                        .asText();
        update(id, Map.of("action", "SAVE", "coverImageUrl", url)).andExpect(status().isOk());
        var asset = cloud.values().iterator().next();
        cloud.put(
                asset.publicId(),
                ArticleImageAsset.builder()
                        .assetId(asset.assetId())
                        .publicId(asset.publicId())
                        .url(asset.url())
                        .ownerId(author)
                        .articleId(id)
                        .fingerprint(asset.fingerprint())
                        .width(2)
                        .height(2)
                        .createdAt(java.time.Instant.now().minusSeconds(172800))
                        .build());
        jdbc.execute("ALTER TABLE techverse.articles DISABLE TRIGGER trg_articles_set_updated_at");
        try {
            jdbc.update(
                    "UPDATE techverse.articles SET updated_at=now()-interval '2 days' WHERE id=?",
                    id);
        } finally {
            jdbc.execute(
                    "ALTER TABLE techverse.articles ENABLE TRIGGER trg_articles_set_updated_at");
        }
        cleanup.clean();
        assertThat(cloud).hasSize(1);
        mvc.perform(
                        patch(ROOT + "/" + id)
                                .header("Authorization", bearer(token))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"action\":\"SAVE\",\"coverImageUrl\":null}"))
                .andExpect(status().isOk());
        cleanup.clean();
        assertThat(cloud).hasSize(1);
        jdbc.execute("ALTER TABLE techverse.articles DISABLE TRIGGER trg_articles_set_updated_at");
        try {
            jdbc.update(
                    "UPDATE techverse.articles SET updated_at=now()-interval '2 days' WHERE id=?",
                    id);
        } finally {
            jdbc.execute(
                    "ALTER TABLE techverse.articles ENABLE TRIGGER trg_articles_set_updated_at");
        }
        cleanup.clean();
        assertThat(cloud).isEmpty();
    }

    @Test
    void cleanupAndSaveCannotCommitAReferenceToADeletedImage() throws Exception {
        UUID id = draft();
        upload(token, id, UUID.randomUUID(), png(2)).andExpect(status().isOk());
        var original = cloud.values().iterator().next();
        var old =
                ArticleImageAsset.builder()
                        .assetId(original.assetId())
                        .publicId(original.publicId())
                        .url(original.url())
                        .ownerId(author)
                        .articleId(id)
                        .fingerprint(original.fingerprint())
                        .width(2)
                        .height(2)
                        .createdAt(java.time.Instant.now().minusSeconds(172800))
                        .build();
        cloud.put(old.publicId(), old);
        jdbc.execute("ALTER TABLE techverse.articles DISABLE TRIGGER trg_articles_set_updated_at");
        try {
            jdbc.update(
                    "UPDATE techverse.articles SET updated_at=now()-interval '2 days' WHERE id=?",
                    id);
        } finally {
            jdbc.execute(
                    "ALTER TABLE techverse.articles ENABLE TRIGGER trg_articles_set_updated_at");
        }
        var deleting = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(
                        i -> {
                            deleting.countDown();
                            if (!release.await(10, TimeUnit.SECONDS))
                                throw new IllegalStateException("Delete timeout");
                            deleteAsset(i.getArgument(0));
                            return null;
                        })
                .when(imageStorage)
                .delete(anyString());
        try (var pool = Executors.newFixedThreadPool(2)) {
            var cleanupTask = pool.submit(() -> cleanup.clean());
            assertThat(deleting.await(10, TimeUnit.SECONDS)).isTrue();
            var saveTask =
                    pool.submit(
                            () ->
                                    update(id, Map.of("action", "SAVE", "coverImageUrl", old.url()))
                                            .andReturn());
            release.countDown();
            cleanupTask.get(20, TimeUnit.SECONDS);
            assertThat(saveTask.get(20, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(400);
        } finally {
            release.countDown();
        }
        assertThat(cloud).isEmpty();
        detail(token, id).andExpect(jsonPath("$.data.coverImageUrl").isEmpty());
    }

    @Test
    void unconfirmedRetirementNeverStartsCloudDeletion() throws Exception {
        UUID id = draft();
        upload(token, id, UUID.randomUUID(), png(2)).andExpect(status().isOk());
        var old = ageUnusedImage(id);
        doThrow(
                        new com.techverse.server.exception.CustomException(
                                com.techverse.server.exception.ErrorCode
                                        .ARTICLE_STORAGE_UNAVAILABLE))
                .when(imageStorage)
                .retire(any());
        cleanup.clean();
        assertThat(cloud).hasSize(1);
        update(id, Map.of("action", "SAVE", "coverImageUrl", old.url())).andExpect(status().isOk());
    }

    @Test
    void retiredUploadKeyIsRejectedEvenWhileCloudDeletionIsUncertain() throws Exception {
        UUID id = draft(), key = UUID.randomUUID();
        upload(token, id, key, png(2)).andExpect(status().isOk());
        ageUnusedImage(id);
        doThrow(
                        new com.techverse.server.exception.CustomException(
                                com.techverse.server.exception.ErrorCode
                                        .ARTICLE_STORAGE_UNAVAILABLE))
                .when(imageStorage)
                .delete(anyString());
        cleanup.clean();
        upload(token, id, key, png(2)).andExpect(status().isBadRequest());
        // A fresh key creates a different provider asset, unaffected by the delayed delete.
        upload(token, id, UUID.randomUUID(), png(2)).andExpect(status().isOk());
    }

    @Test
    void uncertainCloudDeletionMustPreventAttachingTheStillVisibleAsset() throws Exception {
        UUID id = draft();
        upload(token, id, UUID.randomUUID(), png(2)).andExpect(status().isOk());
        var old = ageUnusedImage(id);
        doThrow(
                        new com.techverse.server.exception.CustomException(
                                com.techverse.server.exception.ErrorCode
                                        .ARTICLE_STORAGE_UNAVAILABLE))
                .when(imageStorage)
                .delete(anyString());
        cleanup.clean();
        // The cloud request may still complete after our local timeout. Its URL must not be saved.
        update(id, Map.of("action", "SAVE", "coverImageUrl", old.url()))
                .andExpect(status().isBadRequest());
        cloud.remove(old.publicId()); // delayed remote completion
        detail(token, id).andExpect(jsonPath("$.data.coverImageUrl").isEmpty());
    }

    @Test
    void retryOfOldDetachedImageRenewsItsCleanupGrace() throws Exception {
        UUID id = draft(), key = UUID.randomUUID();
        upload(token, id, key, png(2)).andExpect(status().isOk());
        var old = ageUnusedImage(id);
        upload(token, id, key, png(2)).andExpect(status().isOk());
        cleanup.clean();
        update(id, Map.of("action", "SAVE", "coverImageUrl", old.url())).andExpect(status().isOk());
    }

    @Test
    void retryMustNotReturnAnImageDeletedAfterItsFirstLookup() throws Exception {
        UUID id = draft(), key = UUID.randomUUID();
        upload(token, id, key, png(2)).andExpect(status().isOk());
        var old = ageUnusedImage(id);
        var first = new java.util.concurrent.atomic.AtomicBoolean(true);
        doAnswer(
                        i -> {
                            var asset = Optional.ofNullable(cloud.get(i.getArgument(0)));
                            if (first.getAndSet(false)) cleanup.clean();
                            return asset;
                        })
                .when(imageStorage)
                .find(old.publicId());
        upload(token, id, key, png(2)).andExpect(status().isBadRequest());
        assertThat(cloud).isEmpty();
    }

    private ArticleImageAsset ageUnusedImage(UUID id) {
        var original = cloud.values().iterator().next();
        var old =
                ArticleImageAsset.builder()
                        .assetId(original.assetId())
                        .publicId(original.publicId())
                        .url(original.url())
                        .ownerId(author)
                        .articleId(id)
                        .fingerprint(original.fingerprint())
                        .width(2)
                        .height(2)
                        .createdAt(java.time.Instant.now().minusSeconds(172800))
                        .build();
        cloud.put(old.publicId(), old);
        jdbc.execute("ALTER TABLE techverse.articles DISABLE TRIGGER trg_articles_set_updated_at");
        try {
            jdbc.update(
                    "UPDATE techverse.articles SET updated_at=now()-interval '2 days' WHERE id=?",
                    id);
        } finally {
            jdbc.execute(
                    "ALTER TABLE techverse.articles ENABLE TRIGGER trg_articles_set_updated_at");
        }
        return old;
    }

    private void deleteAsset(String assetId) {
        cloud.values().removeIf(asset -> assetId.equals(asset.assetId()));
    }

    @Test
    void adminSuspensionAndSubmitHaveASerialOutcomeWithoutDeadlock() throws Exception {
        UUID id =
                id(
                        create(UUID.randomUUID(), full("SAVE"))
                                .andExpect(status().isCreated())
                                .andReturn());
        UUID admin = user("admin@example.com", false);
        jdbc.update(
                "INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles"
                        + " WHERE name='ADMIN'",
                admin);
        String adminToken = login("admin@example.com");
        UUID profile =
                jdbc.queryForObject(
                        "SELECT id FROM techverse.author_profiles WHERE user_id=?",
                        UUID.class,
                        author);
        long version =
                jdbc.queryForObject(
                        "SELECT version FROM techverse.author_profiles WHERE user_id=?",
                        Long.class,
                        author);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var submit =
                    pool.submit(
                            () -> {
                                start.await();
                                return update(id, Map.of("action", "SUBMIT")).andReturn();
                            });
            var suspend =
                    pool.submit(
                            () -> {
                                start.await();
                                return mvc.perform(
                                                patch(
                                                                "/api/v1/admin/author-applications/"
                                                                        + profile
                                                                        + "/suspend")
                                                        .header("Authorization", bearer(adminToken))
                                                        .contentType(MediaType.APPLICATION_JSON)
                                                        .content(
                                                                mapper.writeValueAsString(
                                                                        Map.of(
                                                                                "reason",
                                                                                "Policy violation",
                                                                                "expectedVersion",
                                                                                version))))
                                        .andReturn();
                            });
            start.countDown();
            assertThat(suspend.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isEqualTo(200);
            assertThat(submit.get(30, TimeUnit.SECONDS).getResponse().getStatus()).isIn(200, 403);
        }
        update(id, Map.of("action", "SAVE", "title", "No longer allowed"))
                .andExpect(status().isForbidden());
        detail(token, id).andExpect(status().isOk());
    }

    @Test
    void inactiveAccountAndRevokedSessionCannotWrite() throws Exception {
        UUID id = draft();
        jdbc.update("UPDATE techverse.users SET is_active=false WHERE id=?", author);
        update(id, Map.of("action", "SAVE", "title", "Blocked")).andExpect(status().isForbidden());
        jdbc.update("UPDATE techverse.users SET is_active=true WHERE id=?", author);
        mvc.perform(post("/api/v1/auth/logout-all").header("Authorization", bearer(token)))
                .andExpect(status().isOk());
        update(id, Map.of("action", "SAVE", "title", "Revoked"))
                .andExpect(status().isUnauthorized());
    }

    private byte[] png(int width) throws Exception {
        var out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(
                new java.awt.image.BufferedImage(
                        width, 2, java.awt.image.BufferedImage.TYPE_INT_RGB),
                "png",
                out);
        return out.toByteArray();
    }

    private ResultActions upload(String t, UUID id, UUID key, byte[] bytes) throws Exception {
        return mvc.perform(
                multipart(ROOT + "/" + id + "/images")
                        .file(new MockMultipartFile("file", "photo.png", "image/png", bytes))
                        .header("Authorization", bearer(t))
                        .header("Upload-Key", key.toString()));
    }

    private UUID user(String email, boolean isAuthor) {
        UUID id =
                users.saveAndFlush(
                                User.createLocalAccount(
                                        "Test user", email, encoder.encode("SecurePass123!")))
                        .getId();
        if (isAuthor) {
            jdbc.update(
                    "INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM"
                            + " techverse.roles WHERE name='AUTHOR'",
                    id);
            jdbc.update(
                    "INSERT INTO techverse.author_profiles(user_id,bio,expertise,status) VALUES"
                            + " (?,'Bio','Java','APPROVED')",
                    id);
        }
        return id;
    }

    private String login(String email) throws Exception {
        var r =
                mvc.perform(
                                post("/api/v1/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                mapper.writeValueAsString(
                                                        Map.of(
                                                                "email",
                                                                email,
                                                                "password",
                                                                "SecurePass123!"))))
                        .andExpect(status().isOk())
                        .andReturn();
        return mapper.readTree(r.getResponse().getContentAsString())
                .at("/data/accessToken")
                .asText();
    }

    private Map<String, Object> full(String action) {
        return Map.of(
                "action",
                action,
                "title",
                "Title",
                "topicId",
                topic,
                "tagIds",
                List.of(tag),
                "summary",
                "Summary",
                "content",
                "# Content\n```java\n  int i = 1;\n```");
    }

    private UUID draft() throws Exception {
        return id(
                create(
                                UUID.randomUUID(),
                                Map.of("action", "SAVE", "title", "Title", "topicId", topic))
                        .andExpect(status().isCreated())
                        .andReturn());
    }

    private UUID id(MvcResult result) throws Exception {
        return UUID.fromString(
                mapper.readTree(result.getResponse().getContentAsString()).at("/data/id").asText());
    }

    private String bearer(String t) {
        return "Bearer " + t;
    }

    private ResultActions create(UUID key, Object body) throws Exception {
        return createWith(token, key, body);
    }

    private ResultActions createWith(String t, UUID key, Object body) throws Exception {
        return mvc.perform(
                post(ROOT)
                        .header("Authorization", bearer(t))
                        .header("Idempotency-Key", key.toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)));
    }

    private ResultActions update(UUID id, Object body) throws Exception {
        return mvc.perform(
                patch(ROOT + "/" + id)
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(body)));
    }

    private ResultActions detail(String t, UUID id) throws Exception {
        return mvc.perform(get(ROOT + "/" + id).header("Authorization", bearer(t)));
    }

    private List<MvcResult> parallel(Callable<MvcResult> call) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            var ready = new CountDownLatch(2);
            Callable<MvcResult> task =
                    () -> {
                        ready.countDown();
                        start.await(10, TimeUnit.SECONDS);
                        return call.call();
                    };
            var a = pool.submit(task);
            var b = pool.submit(task);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(a.get(40, TimeUnit.SECONDS), b.get(40, TimeUnit.SECONDS));
        }
    }
}
