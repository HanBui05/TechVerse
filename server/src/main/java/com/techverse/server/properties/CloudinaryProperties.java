package com.techverse.server.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.net.URI;

@ConfigurationProperties("cloudinary")
public record CloudinaryProperties(
        @DefaultValue("") String cloudName,
        @DefaultValue("") String apiKey,
        @DefaultValue("") String apiSecret,
        @DefaultValue("techverse/articles") String folder,
        @DefaultValue("https://api.cloudinary.com") URI apiBase,
        @DefaultValue("true") boolean cleanupEnabled) {
    @Override
    public String toString() {
        return "CloudinaryProperties[credentials=REDACTED]";
    }
}
