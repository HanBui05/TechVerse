package com.techverse.server;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
class DatabaseBootstrapIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void appliesV1SchemaAndRecordsIt() {
		assertThat(tableExists("techverse", "users")).isTrue();
		assertThat(successfulMigrationCount("1")).isEqualTo(1);
	}

	private boolean tableExists(String schemaName, String tableName) {
		Boolean exists = jdbcTemplate.queryForObject(
				"""
					SELECT EXISTS (
						SELECT FROM information_schema.tables
						WHERE table_schema = ? AND table_name = ?
					)
					""",
				Boolean.class,
				schemaName,
				tableName);
		return Boolean.TRUE.equals(exists);
	}

	private int successfulMigrationCount(String version) {
		Integer count = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM techverse.flyway_schema_history WHERE version = ? AND success = true",
				Integer.class,
				version);
		return count == null ? 0 : count;
	}
}
