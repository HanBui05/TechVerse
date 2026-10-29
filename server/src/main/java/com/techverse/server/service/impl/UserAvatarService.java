package com.techverse.server.service.impl;

import com.techverse.server.event.GoogleAvatarImportEvent;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AvatarStorage;

import jakarta.persistence.EntityManager;

import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.Semaphore;

import javax.imageio.ImageIO;

@Service
@Slf4j
public class UserAvatarService {
    private final AvatarStorage storage;
    private final ArticleImageDecoder decoder;
    private final UserRepository users;
    private final EntityManager entityManager;
    private final StringRedisTemplate redis;
    private final Executor executor;
    private final GoogleAvatarDownloader google;
    private final TransactionTemplate transaction;
    private final Semaphore uploads = new Semaphore(4);
    private final byte[] defaultPng = defaultIcon();
    private final String fallback =
            "data:image/png;base64," + Base64.getEncoder().encodeToString(defaultPng);
    private String cloudDefault;
    private long defaultRetryAfter;
    private static final DefaultRedisScript<Long> RATE =
            new DefaultRedisScript<>(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then"
                        + " redis.call('EXPIRE',KEYS[1],3600) end; return n",
                    Long.class);

    public UserAvatarService(
            AvatarStorage storage,
            ArticleImageDecoder decoder,
            UserRepository users,
            EntityManager entityManager,
            StringRedisTemplate redis,
            @Qualifier("avatarTaskExecutor") Executor executor,
            PlatformTransactionManager manager,
            GoogleAvatarDownloader google) {
        this.storage = storage;
        this.decoder = decoder;
        this.users = users;
        this.entityManager = entityManager;
        this.redis = redis;
        this.executor = executor;
        this.google = google;
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @TransactionalEventListener
    public void onGoogleSignup(GoogleAvatarImportEvent event) {
        if (event.pictureUrl() == null || event.pictureUrl().isBlank()) return;
        submit(() -> importGoogle(event));
    }

    private void importGoogle(GoogleAvatarImportEvent event) {
        String uploaded = null;
        try {
            byte[] png = decoder.decode(google.download(event.pictureUrl())).bytes();
            uploaded = storage.upload(newId(event.userId()), png).url();
            if (!replace(event.userId(), uploaded, event.expectedAvatar(), true)) {
                cleanup(event.userId(), uploaded);
            }
        } catch (RuntimeException e) {
            if (uploaded != null) cleanup(event.userId(), uploaded);
            log.warn(
                    "Google avatar import unavailable for user {}; keeping current avatar",
                    event.userId());
        }
    }

    public synchronized String defaultAvatar() {
        if (cloudDefault != null) return cloudDefault;
        if (!storage.configured() || System.currentTimeMillis() < defaultRetryAfter)
            return fallback;
        try {
            cloudDefault = storage.upload(AvatarStorage.DEFAULT_ID, defaultPng).url();
            return cloudDefault;
        } catch (RuntimeException e) {
            defaultRetryAfter = System.currentTimeMillis() + 60_000;
            log.warn("Default avatar provisioning unavailable; using embedded fallback");
            return fallback;
        }
    }

    public void changeAvatar(UUID userId, MultipartFile file) {
        assertActive(userId);
        checkRate(userId);
        if (!uploads.tryAcquire()) throw new CustomException(ErrorCode.AVATAR_RATE_LIMITED);
        try {
            byte[] png = decode(file);
            String newUrl = storage.upload(newId(userId), png).url();
            try {
                replace(userId, newUrl, null, false);
            } catch (RuntimeException e) {
                cleanup(userId, newUrl);
                throw e;
            }
        } finally {
            uploads.release();
        }
    }

    /** Locks and refreshes the row after upload: never writes a stale full user snapshot. */
    private boolean replace(UUID userId, String url, String expected, boolean compare) {
        String old =
                transaction.execute(
                        status -> {
                            var user =
                                    users.findByIdForAuthentication(userId)
                                            .orElseThrow(
                                                    () ->
                                                            new CustomException(
                                                                    ErrorCode.USER_NOT_FOUND));
                            entityManager.refresh(user);
                            if (!user.isActive())
                                throw new CustomException(ErrorCode.USER_INACTIVE);
                            if (compare && !Objects.equals(expected, user.getAvatarUrl()))
                                return null;
                            String previous = user.getAvatarUrl();
                            users.updateAvatarUrl(userId, url);
                            entityManager.refresh(user);
                            return previous == null ? "" : previous;
                        });
        if (old == null) return false;
        if (!old.isEmpty()) cleanup(userId, old);
        return true;
    }

    private void assertActive(UUID userId) {
        var user =
                users.findById(userId)
                        .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        if (!user.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
    }

    private void checkRate(UUID userId) {
        try {
            Long n = redis.execute(RATE, List.of("avatar:rate:" + userId));
            if (n == null) throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
            if (n > 20) throw new CustomException(ErrorCode.AVATAR_RATE_LIMITED);
        } catch (org.springframework.dao.DataAccessException e) {
            throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
        }
    }

    private byte[] decode(MultipartFile file) {
        try {
            return decoder.decode(file).bytes();
        } catch (CustomException e) {
            throw translate(e);
        }
    }

    private CustomException translate(CustomException e) {
        return new CustomException(
                switch (e.getErrorCode()) {
                    case ARTICLE_FILE_TOO_LARGE -> ErrorCode.AVATAR_FILE_TOO_LARGE;
                    case ARTICLE_FILE_UNSUPPORTED -> ErrorCode.AVATAR_FILE_UNSUPPORTED;
                    default -> ErrorCode.AVATAR_IMAGE_INVALID;
                });
    }

    private String newId(UUID userId) {
        return AvatarStorage.FOLDER + "/" + userId + "/" + UUID.randomUUID();
    }

    private void cleanup(UUID userId, String url) {
        submit(
                () -> {
                    try {
                        storage.deleteOwned(userId, url);
                    } catch (RuntimeException e) {
                        log.warn("Could not clean up an unused avatar for user {}", userId);
                    }
                });
    }

    private void submit(Runnable task) {
        try {
            executor.execute(task);
        } catch (RuntimeException e) {
            log.warn("Avatar worker queue unavailable; retaining the current avatar");
        }
    }

    private static byte[] defaultIcon() {
        var image = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setPaint(
                    new GradientPaint(
                            0, 0, new Color(15, 23, 42), 256, 256, new Color(30, 64, 90)));
            g.fillRect(0, 0, 256, 256);
            g.setColor(new Color(56, 189, 248));
            g.fillOval(88, 44, 80, 80);
            g.fillRoundRect(48, 144, 160, 136, 100, 100);
            var out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Could not generate default avatar", e);
        } finally {
            g.dispose();
        }
    }
}
