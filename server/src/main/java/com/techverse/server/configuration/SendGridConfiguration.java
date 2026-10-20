package com.techverse.server.configuration;

import com.sendgrid.SendGrid;
import com.techverse.server.properties.SendGridProperties;
import java.util.concurrent.Executor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
@EnableConfigurationProperties(SendGridProperties.class)
public class SendGridConfiguration {

	@Bean
	SendGrid sendGrid(SendGridProperties sendGridProperties) {
		return new SendGrid(sendGridProperties.apiKey());
	}

	@Bean(name = "emailTaskExecutor")
	Executor emailTaskExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(2);
		executor.setMaxPoolSize(4);
		executor.setQueueCapacity(50);
		executor.setThreadNamePrefix("techverse-email-");
		executor.initialize();
		return executor;
	}
}
