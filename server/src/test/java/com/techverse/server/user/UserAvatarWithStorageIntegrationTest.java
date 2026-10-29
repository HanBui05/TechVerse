package com.techverse.server.user;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.dto.internal.AvatarAsset;
import com.techverse.server.dto.internal.SocialProfile;
import com.techverse.server.entity.User;
import com.techverse.server.enums.SocialProvider;
import com.techverse.server.exception.*;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthService;
import com.techverse.server.service.AvatarStorage;
import com.techverse.server.service.impl.GoogleAvatarDownloader;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserAvatarWithStorageIntegrationTest {
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
    @Autowired AuthService auth;
    @Autowired PasswordEncoder encoder;
    @Autowired PlatformTransactionManager txManager;
    @Autowired org.springframework.data.redis.core.StringRedisTemplate redisTemplate;
    @MockitoBean AvatarStorage storage;
    @MockitoBean GoogleAvatarDownloader downloader;

    @MockitoBean(name = "avatarTaskExecutor")
    ThreadPoolTaskExecutor executor;

    final Queue<Runnable> jobs = new ConcurrentLinkedQueue<>();
    final Map<String, byte[]> assets = new ConcurrentHashMap<>();
    static final String DEFAULT =
            "https://res.cloudinary.com/demo/image/upload/v1/techverse/avatars/default.png";
    static final String GOOGLE = "https://lh3.googleusercontent.com/a/photo";
    UUID userId;
    String token;

    @BeforeEach
    void setup() throws Exception {
        jobs.clear();
        assets.clear();
        jdbc.execute("TRUNCATE techverse.users CASCADE");
        jdbc.execute(
                "INSERT INTO techverse.roles(name) VALUES"
                        + " ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        doAnswer(
                        call -> {
                            jobs.add(call.getArgument(0));
                            return null;
                        })
                .when(executor)
                .execute(any(Runnable.class));
        when(storage.configured()).thenReturn(true);
        when(storage.upload(anyString(), any()))
                .thenAnswer(call -> asset(call.getArgument(0), call.getArgument(1)));
        doAnswer(
                        call -> {
                            String url = call.getArgument(1);
                            if (url.contains("/" + call.getArgument(0) + "/")) assets.remove(url);
                            return null;
                        })
                .when(storage)
                .deleteOwned(any(), any());
        when(downloader.download(GOOGLE)).thenReturn(UserAvatarIntegrationTest.png());
        userId =
                users.saveAndFlush(
                                User.createLocalAccount(
                                        "Avatar User",
                                        "avatar@example.com",
                                        encoder.encode("SecurePass123!")))
                        .getId();
        var result =
                mvc.perform(
                                post("/api/v1/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"email\":\"avatar@example.com\",\"password\":\"SecurePass123!\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        token =
                mapper.readTree(result.getResponse().getContentAsString())
                        .at("/data/accessToken")
                        .asText();
    }

    @Test
    void uploadPersistsOwnAvatarReturnsProfileAndKeepsAuditAndOtherFields() throws Exception {
        var result = upload(UserAvatarIntegrationTest.png()).andExpect(status().isOk()).andReturn();
        String url =
                mapper.readTree(result.getResponse().getContentAsString())
                        .at("/data/avatarUrl")
                        .asText();
        var user = users.findById(userId).orElseThrow();
        assertThat(url).contains("/" + userId + "/");
        assertThat(user.getAvatarUrl()).isEqualTo(url);
        assertThat(user.getEmail()).isEqualTo("avatar@example.com");
        assertThat(user.getFullName()).isEqualTo("Avatar User");
        assertThat(user.getUpdatedBy()).isEqualTo(userId);
        mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avatarUrl").value(url));
    }

    @Test
    void anonymousUploadIsUnauthorized() throws Exception {
        mvc.perform(
                        multipart("/api/v1/users/me/avatar")
                                .file(
                                        new MockMultipartFile(
                                                "file",
                                                "avatar.png",
                                                "image/png",
                                                UserAvatarIntegrationTest.png()))
                                .with(
                                        request -> {
                                            request.setMethod("PATCH");
                                            return request;
                                        }))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void oversizeImageIsRejectedBeforeProviderCall() throws Exception {
        upload(new byte[5 * 1024 * 1024 + 1]).andExpect(status().isPayloadTooLarge());
        assertThat(users.findById(userId).orElseThrow().getAvatarUrl()).isNull();
        assertThat(assets).isEmpty();
    }

    @Test
    void providerFailureRetainsThePreviousAvatar() throws Exception {
        jdbc.update("UPDATE techverse.users SET avatar_url='original' WHERE id=?", userId);
        doThrow(new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE))
                .when(storage)
                .upload(anyString(), any());
        upload(UserAvatarIntegrationTest.png()).andExpect(status().isServiceUnavailable());
        assertThat(users.findById(userId).orElseThrow().getAvatarUrl()).isEqualTo("original");
    }

    @Test
    void accountLockedDuringUploadCannotReceiveAnAvatarAndNewAssetIsCleaned() throws Exception {
        doAnswer(
                        call -> {
                            var asset = asset(call.getArgument(0), call.getArgument(1));
                            jdbc.update(
                                    "UPDATE techverse.users SET is_active=false WHERE id=?",
                                    userId);
                            return asset;
                        })
                .when(storage)
                .upload(anyString(), any());
        upload(UserAvatarIntegrationTest.png()).andExpect(status().isForbidden());
        drain();
        assertThat(users.findById(userId).orElseThrow().getAvatarUrl()).isNull();
        assertThat(assets).isEmpty();
    }

    @Test
    void newGoogleAccountStartsWithDefaultAndImportsOnlyAfterCommit() {
        auth.authenticateSocialAccount(profile());
        var user = users.findByEmail("google.avatar@example.com").orElseThrow();
        assertThat(user.getAvatarUrl()).isEqualTo(DEFAULT);
        assertThat(jobs).hasSize(1);
        drain();
        var updated = users.findById(user.getId()).orElseThrow();
        assertThat(updated.getAvatarUrl()).contains("/" + user.getId() + "/");
        assertThat(updated.getUpdatedBy()).isEqualTo(user.getId());
        assertThat(assets).containsKey(updated.getAvatarUrl());
    }

    @Test
    void lateGoogleImportCannotOverwriteManualAvatarAndLaterLoginDoesNotResync() throws Exception {
        var refresh = auth.authenticateSocialAccount(profile());
        var user = users.findByEmail("google.avatar@example.com").orElseThrow();
        token = auth.refresh(refresh.getValue()).getAccessToken().getValue();
        upload(UserAvatarIntegrationTest.png()).andExpect(status().isOk());
        String manual = users.findById(user.getId()).orElseThrow().getAvatarUrl();
        drain();
        assertThat(users.findById(user.getId()).orElseThrow().getAvatarUrl()).isEqualTo(manual);
        assertThat(assets).containsKey(manual);
        auth.authenticateSocialAccount(profile());
        assertThat(jobs).isEmpty();
        assertThat(users.findById(user.getId()).orElseThrow().getAvatarUrl()).isEqualTo(manual);
    }

    @Test
    void googleDownloadFailureKeepsLoginAndDefaultWorking() {
        when(downloader.download(GOOGLE))
                .thenThrow(new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE));
        var refresh = auth.authenticateSocialAccount(profile());
        drain();
        assertThat(auth.refresh(refresh.getValue()).getAccessToken().getValue()).isNotBlank();
        assertThat(users.findByEmail("google.avatar@example.com").orElseThrow().getAvatarUrl())
                .isEqualTo(DEFAULT);
    }

    @Test
    void googleWithoutPictureStillGetsDefaultAndCanLogin() {
        var profile =
                SocialProfile.builder()
                        .provider(SocialProvider.GOOGLE)
                        .providerId("no-picture")
                        .email("no.picture@example.com")
                        .fullName("No Picture")
                        .emailVerified(true)
                        .build();
        var refresh = auth.authenticateSocialAccount(profile);
        assertThat(auth.refresh(refresh.getValue()).getAccessToken().getValue()).isNotBlank();
        assertThat(users.findByEmail("no.picture@example.com").orElseThrow().getAvatarUrl())
                .isEqualTo(DEFAULT);
        assertThat(jobs).isEmpty();
    }

    @Test
    void queueRejectionMustNotTurnCommittedGoogleSignupIntoAnError() {
        doThrow(new RejectedExecutionException()).when(executor).execute(any(Runnable.class));
        var refresh = auth.authenticateSocialAccount(profile());
        assertThat(auth.refresh(refresh.getValue()).getAccessToken().getValue()).isNotBlank();
        assertThat(users.findByEmail("google.avatar@example.com").orElseThrow().getAvatarUrl())
                .isEqualTo(DEFAULT);
    }

    @Test
    void rolledBackSignupNeverImportsGoogleImage() {
        new TransactionTemplate(txManager)
                .executeWithoutResult(
                        status -> {
                            auth.authenticateSocialAccount(profile());
                            status.setRollbackOnly();
                        });
        assertThat(users.findByEmail("google.avatar@example.com")).isEmpty();
        assertThat(jobs).isEmpty();
    }

    @Test
    void simultaneousUploadsNeverCleanTheWinnerOrLoseOtherProfileEdits() throws Exception {
        var barrier = new CyclicBarrier(2);
        doAnswer(
                        call -> {
                            var image = asset(call.getArgument(0), call.getArgument(1));
                            jdbc.update(
                                    "UPDATE techverse.users SET full_name='Updated profile' WHERE"
                                            + " id=?",
                                    userId);
                            barrier.await(15, TimeUnit.SECONDS);
                            return image;
                        })
                .when(storage)
                .upload(anyString(), any());
        var pool = Executors.newFixedThreadPool(2);
        try {
            var a =
                    pool.submit(
                            () ->
                                    upload(UserAvatarIntegrationTest.png())
                                            .andExpect(status().isOk()));
            var b =
                    pool.submit(
                            () ->
                                    upload(UserAvatarIntegrationTest.png())
                                            .andExpect(status().isOk()));
            a.get(30, TimeUnit.SECONDS);
            b.get(30, TimeUnit.SECONDS);
            drain();
            String current = users.findById(userId).orElseThrow().getAvatarUrl();
            assertThat(assets).containsOnlyKeys(current);
            assertThat(users.findById(userId).orElseThrow().getFullName())
                    .isEqualTo("Updated profile");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentLimitRejectsBeforeDecodingAnotherImage() throws Exception {
        var occupied = new CountDownLatch(4);
        var release = new CountDownLatch(1);
        doAnswer(
                        call -> {
                            occupied.countDown();
                            if (!release.await(20, TimeUnit.SECONDS))
                                throw new IllegalStateException("test timeout");
                            return asset(call.getArgument(0), call.getArgument(1));
                        })
                .when(storage)
                .upload(anyString(), any());
        var pool = Executors.newFixedThreadPool(4);
        var pending = new ArrayList<Future<?>>();
        try {
            for (int i = 0; i < 4; i++) {
                pending.add(
                        pool.submit(
                                () -> {
                                    upload(UserAvatarIntegrationTest.png())
                                            .andExpect(status().isOk());
                                    return null;
                                }));
            }
            assertThat(occupied.await(15, TimeUnit.SECONDS)).isTrue();
            upload("not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8))
                    .andExpect(status().isTooManyRequests());
        } finally {
            release.countDown();
            for (var request : pending) request.get(30, TimeUnit.SECONDS);
            pool.shutdownNow();
        }
    }

    @Test
    void exhaustedQuotaRejectsBeforeDecodingAnotherImage() throws Exception {
        redisTemplate
                .opsForValue()
                .set("avatar:rate:" + userId, "20", java.time.Duration.ofHours(1));
        upload("not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8))
                .andExpect(status().isTooManyRequests());
        assertThat(users.findById(userId).orElseThrow().getAvatarUrl()).isNull();
    }

    @Test
    void invalidImagesDoNotLeakUploadPermits() throws Exception {
        for (int i = 0; i < 4; i++) {
            upload("not an image".getBytes(java.nio.charset.StandardCharsets.UTF_8))
                    .andExpect(status().isUnsupportedMediaType());
        }
        upload(UserAvatarIntegrationTest.png()).andExpect(status().isOk());
    }

    SocialProfile profile() {
        return SocialProfile.builder()
                .provider(SocialProvider.GOOGLE)
                .providerId("google-avatar-sub")
                .email("google.avatar@example.com")
                .fullName("Google Avatar")
                .emailVerified(true)
                .pictureUrl(GOOGLE)
                .build();
    }

    AvatarAsset asset(String id, byte[] png) {
        String url = "https://res.cloudinary.com/demo/image/upload/v1/" + id + ".png";
        assets.put(url, png);
        return AvatarAsset.builder()
                .publicId(id)
                .assetId(UUID.randomUUID().toString())
                .url(url)
                .build();
    }

    ResultActions upload(byte[] bytes) throws Exception {
        return mvc.perform(
                multipart("/api/v1/users/me/avatar")
                        .file(new MockMultipartFile("file", "avatar.png", "image/png", bytes))
                        .with(
                                request -> {
                                    request.setMethod("PATCH");
                                    return request;
                                })
                        .header("Authorization", "Bearer " + token));
    }

    void drain() {
        for (Runnable job; (job = jobs.poll()) != null; ) job.run();
    }
}
