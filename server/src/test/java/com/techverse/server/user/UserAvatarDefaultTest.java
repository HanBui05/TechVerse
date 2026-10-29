package com.techverse.server.user;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.techverse.server.dto.internal.AvatarAsset;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AvatarStorage;
import com.techverse.server.service.impl.*;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.PlatformTransactionManager;

import java.io.ByteArrayInputStream;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicInteger;

import javax.imageio.ImageIO;

class UserAvatarDefaultTest {
    @Test
    void providerOutageUsesActualPngAndCooldownAvoidsRepeatedNetworkFailures() throws Exception {
        var storage = mock(AvatarStorage.class);
        when(storage.configured()).thenReturn(true);
        AtomicInteger calls = new AtomicInteger();
        when(storage.upload(eq("techverse/avatars/default"), any()))
                .thenAnswer(
                        call -> {
                            calls.incrementAndGet();
                            throw new IllegalStateException("provider down");
                        });
        var service = service(storage);
        String first = service.defaultAvatar();
        assertThat(first).startsWith("data:image/png;base64,");
        assertThat(
                        ImageIO.read(
                                new ByteArrayInputStream(
                                        Base64.getDecoder().decode(first.substring(22)))))
                .isNotNull();
        assertThat(service.defaultAvatar()).isEqualTo(first);
        assertThat(calls).hasValue(1);
    }

    @Test
    void successfullyProvisionedSharedDefaultIsReusedAcrossRegistrations() {
        var storage = mock(AvatarStorage.class);
        when(storage.configured()).thenReturn(true);
        AtomicInteger calls = new AtomicInteger();
        String url =
                "https://res.cloudinary.com/demo/image/upload/v1/techverse/avatars/default.png";
        when(storage.upload(eq("techverse/avatars/default"), any()))
                .thenAnswer(
                        call -> {
                            calls.incrementAndGet();
                            return AvatarAsset.builder().url(url).build();
                        });
        var service = service(storage);
        assertThat(service.defaultAvatar()).isEqualTo(url);
        assertThat(service.defaultAvatar()).isEqualTo(url);
        assertThat(calls).hasValue(1);
    }

    UserAvatarService service(AvatarStorage storage) {
        return new UserAvatarService(
                storage,
                new ArticleImageDecoder(),
                mock(UserRepository.class),
                mock(EntityManager.class),
                mock(StringRedisTemplate.class),
                Runnable::run,
                mock(PlatformTransactionManager.class),
                mock(GoogleAvatarDownloader.class));
    }
}
