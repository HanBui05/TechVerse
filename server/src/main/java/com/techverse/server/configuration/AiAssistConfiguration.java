package com.techverse.server.configuration;

import com.techverse.server.properties.AiAssistProperties;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Duration;

/**
 * AI stays optional: with {@code spring.ai.model.chat=none} no ChatModel exists and AI endpoints
 * answer AI_CONFIGURATION_INVALID. Enabling it without a key fails startup instead, because an
 * empty key makes the SDK silently run in no-auth mode.
 */
@Configuration
@EnableConfigurationProperties(AiAssistProperties.class)
public class AiAssistConfiguration {

    AiAssistConfiguration(Environment environment, AiAssistProperties properties) {
        verify(
                environment,
                environment.getProperty("spring.mvc.async.request-timeout", Duration.class),
                properties.longestDraftTimeout());
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    /** Messages name properties only, never their values. */
    public static void verify(Environment environment, Duration asyncTimeout, Duration longestDraft) {
        if ("openai".equals(environment.getProperty("spring.ai.model.chat"))
                && !StringUtils.hasText(environment.getProperty("spring.ai.openai.api-key")))
            throw new IllegalStateException(
                    "AI_MODEL_CHAT=openai requires AI_API_KEY (spring.ai.openai.api-key) to be set");
        if (asyncTimeout == null || asyncTimeout.compareTo(longestDraft) <= 0)
            throw new IllegalStateException(
                    "spring.mvc.async.request-timeout must be longer than the longest"
                            + " ai.assist.draft-timeouts value");
    }
}
