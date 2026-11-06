package com.techverse.server.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.openai.core.http.Headers;
import com.openai.errors.OpenAIIoException;
import com.openai.errors.RateLimitException;
import com.openai.errors.UnauthorizedException;
import com.openai.errors.UnexpectedStatusCodeException;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.service.impl.AiProviderExceptionMapper;
import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AiProviderExceptionMapperTest {

  final AiProviderExceptionMapper mapper = new AiProviderExceptionMapper();

  static UnexpectedStatusCodeException status(int code) {
    return UnexpectedStatusCodeException.builder()
        .statusCode(code)
        .headers(Headers.builder().build())
        .error(java.util.Optional.empty())
        .build();
  }

  @ParameterizedTest
  @CsvSource({
    "401, AI_PROVIDER_AUTH_FAILED",
    "403, AI_PROVIDER_AUTH_FAILED",
    "429, AI_PROVIDER_RATE_LIMITED",
    "400, AI_PROVIDER_REQUEST_REJECTED",
    "404, AI_PROVIDER_REQUEST_REJECTED",
    "413, AI_PROVIDER_REQUEST_REJECTED",
    "422, AI_PROVIDER_REQUEST_REJECTED",
    "424, AI_PROVIDER_REQUEST_REJECTED",
    "498, AI_PROVIDER_UNAVAILABLE",
    "499, AI_PROVIDER_UNAVAILABLE",
    "500, AI_PROVIDER_UNAVAILABLE",
    "502, AI_PROVIDER_UNAVAILABLE",
    "503, AI_PROVIDER_UNAVAILABLE",
    "206, AI_PROVIDER_UNAVAILABLE"
  })
  void providerStatusMapsToGenericCode(int code, ErrorCode expected) {
    assertThat(mapper.map(status(code)).getErrorCode()).isEqualTo(expected);
  }

  @Test
  void typedSdkExceptionsMapByStatus() {
    var unauthorized = UnauthorizedException.builder()
        .headers(Headers.builder().build()).error(java.util.Optional.empty()).build();
    var rateLimited = RateLimitException.builder()
        .headers(Headers.builder().put("retry-after", "7").build()).error(java.util.Optional.empty()).build();
    assertThat(mapper.map(unauthorized).getErrorCode()).isEqualTo(ErrorCode.AI_PROVIDER_AUTH_FAILED);
    assertThat(mapper.map(rateLimited).getErrorCode()).isEqualTo(ErrorCode.AI_PROVIDER_RATE_LIMITED);
  }

  @Test
  void networkFailuresAreUnavailable() {
    assertThat(mapper.map(new OpenAIIoException("io", new UnknownHostException("api.groq.com"))).getErrorCode())
        .isEqualTo(ErrorCode.AI_PROVIDER_UNAVAILABLE);
    assertThat(mapper.map(new IllegalStateException("unreadable")).getErrorCode())
        .isEqualTo(ErrorCode.AI_PROVIDER_UNAVAILABLE);
  }

  @Test
  void timeoutsAnywhereInTheCauseChainMapToTimeout() {
    assertThat(mapper.map(new OpenAIIoException("io", new SocketTimeoutException("read timed out"))).getErrorCode())
        .isEqualTo(ErrorCode.AI_TIMEOUT);
    assertThat(mapper.map(new RuntimeException(new OpenAIIoException("io", new InterruptedIOException("timeout"))))
            .getErrorCode())
        .isEqualTo(ErrorCode.AI_TIMEOUT);
    assertThat(mapper.map(new TimeoutException()).getErrorCode()).isEqualTo(ErrorCode.AI_TIMEOUT);
  }

  @Test
  void wrappedServiceExceptionIsFoundInCauseChain() {
    assertThat(mapper.map(new RuntimeException(status(429))).getErrorCode())
        .isEqualTo(ErrorCode.AI_PROVIDER_RATE_LIMITED);
  }

  @Test
  void mappedExceptionCarriesOnlyTheGenericMessage() {
    CustomException mapped = mapper.map(status(401));
    assertThat(mapped.getMessage()).isEqualTo(ErrorCode.AI_PROVIDER_AUTH_FAILED.getMessage());
    assertThat(mapped.getMessage()).doesNotContain("gsk_secret");
    assertThat(mapped.getCause()).isNull();
  }

  @Test
  void customExceptionsPassThroughUnchanged() {
    var original = new CustomException(ErrorCode.AI_OUTPUT_INVALID);
    assertThat(mapper.map(original)).isSameAs(original);
  }
}
