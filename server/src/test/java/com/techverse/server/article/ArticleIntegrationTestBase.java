package com.techverse.server.article;

import com.techverse.server.repository.ArticleCreationRepository;
import com.techverse.server.service.ArticleImageStorage;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * One Postgres/Redis pair and one Spring context key for every article integration class.
 * Containers start once per JVM (no {@code @Container}: per-class stop would break the cached
 * context); Ryuk removes them at exit. Subclasses still clean their own data in {@code @BeforeEach}.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ArticleIntegrationTestBase {
    @ServiceConnection
    protected static final PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @ServiceConnection(name = "redis")
    protected static final GenericContainer<?> redis =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    static {
        postgres.start();
        redis.start();
    }

    @MockitoBean protected ArticleImageStorage imageStorage;
    @MockitoSpyBean protected ArticleCreationRepository receipts;
}
