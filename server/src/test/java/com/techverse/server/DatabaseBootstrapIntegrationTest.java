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
	void appliesSchemaMigrationsAndRecordsThem() {
		assertThat(tableExists("techverse", "users")).isTrue();
		assertThat(successfulMigrationCount("1")).isEqualTo(1);
		assertThat(successfulMigrationCount("2")).isEqualTo(1);
		assertThat(columnExists("techverse", "users", "email_verified_at")).isFalse();
	}

	@Test
	void configuresDatabaseConnectionsForVietnamTime() {
		assertThat(jdbcTemplate.queryForObject("SHOW TIME ZONE", String.class))
				.isEqualTo("Asia/Ho_Chi_Minh");
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

	private boolean columnExists(String schemaName, String tableName, String columnName) {
		Boolean exists = jdbcTemplate.queryForObject(
				"""
					SELECT EXISTS (
						SELECT FROM information_schema.columns
						WHERE table_schema = ? AND table_name = ? AND column_name = ?
					)
					""",
				Boolean.class,
				schemaName,
				tableName,
				columnName);
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
