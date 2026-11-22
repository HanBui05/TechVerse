package com.techverse.server.configuration;

import com.techverse.server.properties.OAuth2Properties;

import lombok.RequiredArgsConstructor;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/** {@code /ws/messaging}: the handler checks Origin and spends the ticket itself (CORS and the JWT filter do not apply here). */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class MessageSocketConfiguration implements WebSocketConfigurer {
    private final MessageSocketHandler handler;
    private final OAuth2Properties oauth2;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Spring's own origin check would otherwise allow same-origin only; ours runs first in the handler.
        registry.addHandler(handler, MessageSocketHandler.PATH).addInterceptors(handler).setAllowedOrigins(oauth2.webUrl());
    }
}
