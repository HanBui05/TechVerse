package com.techverse.server.configuration;

import com.techverse.server.properties.CloudinaryProperties;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@EnableConfigurationProperties(CloudinaryProperties.class)
public class ArticleConfiguration {}
