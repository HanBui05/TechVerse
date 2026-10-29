package com.techverse.server.service.impl;

import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.Flow;

@Service
public class GoogleAvatarDownloader {
    private final HttpClient http =
            HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(4))
                    .followRedirects(HttpClient.Redirect.NEVER)
                    .build();

    public byte[] download(String url) {
        URI uri;
        try {
            uri = URI.create(url);
            if (!"https".equals(uri.getScheme())
                    || uri.getHost() == null
                    || !uri.getHost().matches("lh[0-9]+\\.googleusercontent\\.com")
                    || uri.getRawUserInfo() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new CustomException(ErrorCode.AVATAR_IMAGE_INVALID);
        }
        var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8)).GET().build();
        var pending = http.sendAsync(request, info -> new LimitedBody());
        try {
            var response = pending.get(8, TimeUnit.SECONDS);
            if (response.statusCode() != 200)
                throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
            return response.body();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
        } catch (ExecutionException | TimeoutException e) {
            throw new CustomException(ErrorCode.AVATAR_STORAGE_UNAVAILABLE);
        } finally {
            pending.cancel(true);
        }
    }

    /** Bounds bytes before buffering, including chunked bodies without Content-Length. */
    private static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> result = new CompletableFuture<>();
        private final ByteArrayOutputStream out = new ByteArrayOutputStream();
        private Flow.Subscription subscription;

        @Override
        public CompletionStage<byte[]> getBody() {
            return result;
        }

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            subscription.request(1);
        }

        @Override
        public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer : buffers) {
                if ((long) out.size() + buffer.remaining() > ArticleImageDecoder.MAX_BYTES) {
                    subscription.cancel();
                    result.completeExceptionally(
                            new CustomException(ErrorCode.AVATAR_FILE_TOO_LARGE));
                    return;
                }
                byte[] bytes = new byte[buffer.remaining()];
                buffer.get(bytes);
                out.writeBytes(bytes);
            }
            subscription.request(1);
        }

        @Override
        public void onError(Throwable error) {
            result.completeExceptionally(error);
        }

        @Override
        public void onComplete() {
            result.complete(out.toByteArray());
        }
    }
}
