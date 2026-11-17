package com.techverse.server.course;

import static org.assertj.core.api.Assertions.*;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

/** Plain Flyway (V1 to the latest) against a real empty PostgreSQL: no Spring context. */
@Testcontainers
class CoursePaymentMigrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    static JdbcTemplate jdbc;
    static final String HEX = "a".repeat(64);

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .schemas("techverse")
                .defaultSchema("techverse")
                .createSchemas(true)
                .locations("classpath:db/migration")
                .load()
                .migrate();
        jdbc = new JdbcTemplate(new DriverManagerDataSource(
                postgres.getJdbcUrl() + (postgres.getJdbcUrl().contains("?") ? "&" : "?") + "currentSchema=techverse,public",
                postgres.getUsername(),
                postgres.getPassword()));
    }

    @Test
    void priceIsFreeOrWithinTenThousandToFiftyMillion() {
        UUID course = course(0);
        for (long ok : new long[] {0, 10_000, 50_000_000})
            assertThat(jdbc.update("UPDATE courses SET price_amount=? WHERE id=?", ok, course)).isEqualTo(1);
        for (long bad : new long[] {-1, 1, 9_999, 50_000_001})
            assertThatThrownBy(() -> jdbc.update("UPDATE courses SET price_amount=? WHERE id=?", bad, course))
                    .as("price %d", bad)
                    .hasMessageContaining("ck_courses_price");
        assertThatThrownBy(() -> jdbc.update("UPDATE courses SET currency='USD' WHERE id=?", course))
                .hasMessageContaining("ck_courses_currency");
    }

    @Test
    void seedsOneActiveCommissionPolicyOf2000Bps() {
        assertThat(jdbc.queryForList("SELECT rate_bps FROM commission_policies WHERE is_active", Integer.class))
                .containsExactly(2000);
    }

    @Test
    void dropsRefundsWithItsTriggersAndFunctionsKeepingTheRest() {
        assertThat(count("information_schema.tables", "table_name='refunds'")).isZero();
        assertThat(count("pg_proc", "proname IN ('validate_refund','revoke_course_access_after_refund')")).isZero();
        assertThat(count("information_schema.tables", "table_name IN ('orders','order_items','payment_transactions')"))
                .isEqualTo(3);
        assertThat(count("pg_proc", "proname='grant_course_access_after_payment'")).isEqualTo(1);
        // Remaining audit trigger still bumps updated_at, except for a price-only update (the moderator
        // review token is bound to updated_at, and price is outside the review).
        UUID course = course(0);
        var created = updatedAt(course);
        jdbc.update("UPDATE courses SET price_amount = 10000 WHERE id=?", course);
        assertThat(updatedAt(course)).isEqualTo(created);
        jdbc.update("UPDATE courses SET title='Changed' WHERE id=?", course);
        assertThat(updatedAt(course)).isAfter(created);
    }

    @Test
    void authorPayoutsArePositiveUniqueByReferenceAndImmutable() {
        UUID author = jdbc.queryForObject("INSERT INTO users(full_name, email) VALUES ('A', ?) RETURNING id",
                UUID.class, UUID.randomUUID() + "@example.com");
        String ref = "FT" + UUID.randomUUID();
        UUID id = payout(author, 100_000, ref);
        assertThatThrownBy(() -> payout(author, 0, "FT" + UUID.randomUUID())).hasMessageContaining("ck_author_payouts_amount");
        assertThatThrownBy(() -> payout(author, -1, "FT" + UUID.randomUUID())).hasMessageContaining("ck_author_payouts_amount");
        assertThatThrownBy(() -> payout(author, 5, ref)).hasMessageContaining("uq_author_payouts_bank_reference");
        assertThatThrownBy(() -> jdbc.update("UPDATE author_payouts SET amount = 1 WHERE id=?", id)).hasMessageContaining("immutable");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM author_payouts WHERE id=?", id)).hasMessageContaining("immutable");
        assertThat(jdbc.queryForObject("SELECT amount FROM author_payouts WHERE id=?", Long.class, id)).isEqualTo(100_000);

        // One account per author.
        jdbc.update("INSERT INTO author_payout_accounts(user_id, bank_id, account_no, account_name) VALUES (?,'970436','0123456','A')", author);
        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO author_payout_accounts(user_id, bank_id, account_no, account_name) VALUES (?,'970436','999999','B')", author))
                .hasMessageContaining("author_payout_accounts_pkey");
    }

    private static UUID payout(UUID author, long amount, String ref) {
        return jdbc.queryForObject("INSERT INTO author_payouts(author_id, amount, bank_reference, bank_id, account_no, account_name, created_by)"
                + " VALUES (?,?,?,'970436','0123456789','NGUYEN VAN A',?) RETURNING id", UUID.class, author, amount, ref, author);
    }

    private static UUID course(long price) {
        UUID author = jdbc.queryForObject(
                "INSERT INTO users(full_name, email) VALUES ('Author', ?) RETURNING id",
                UUID.class, UUID.randomUUID() + "@example.com");
        UUID topic = jdbc.queryForObject("INSERT INTO topics(name) VALUES (?) RETURNING id", UUID.class, "T" + UUID.randomUUID());
        return jdbc.queryForObject(
                "INSERT INTO courses(author_id, topic_id, title, summary, description, level, content_fingerprint, price_amount)"
                        + " VALUES (?,?,'T','S','D','BEGINNER',?,?) RETURNING id",
                UUID.class, author, topic, HEX, price);
    }

    private static java.time.OffsetDateTime updatedAt(UUID course) {
        return jdbc.queryForObject("SELECT updated_at FROM courses WHERE id=?", java.time.OffsetDateTime.class, course);
    }

    private static int count(String from, String where) {
        return jdbc.queryForObject("SELECT count(*) FROM " + from + " WHERE " + where
                + (from.startsWith("information_schema") ? " AND table_schema='techverse'" : ""), Integer.class);
    }
}
