package com.techverse.server.dashboard;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.article.ArticleIntegrationTestBase;
import com.techverse.server.entity.User;
import com.techverse.server.repository.AiCompletedGenerationRepository;
import com.techverse.server.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.UUID;

/** Dashboard counts against a real database and the real security chain. */
class DashboardIntegrationTest extends ArticleIntegrationTestBase {
    static final String ADMIN = "/api/v1/admin/dashboard";
    static final String MOD = "/api/v1/moderator/dashboard";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    // Same override set as the course integration classes, so this class reuses their Spring context.
    @MockitoSpyBean AiCompletedGenerationRepository aiGenerations;

    UUID admin, mod, both, topic;
    String adminToken, modToken, bothToken;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users, techverse.topics, techverse.tags CASCADE");
        jdbc.execute("INSERT INTO techverse.roles(name) VALUES ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        admin = user("admin@example.com", "ADMIN");
        mod = user("mod@example.com", "MODERATOR");
        both = user("both@example.com", "ADMIN", "MODERATOR");
        adminToken = login("admin@example.com");
        modToken = login("mod@example.com");
        bothToken = login("both@example.com");
        topic = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Backend') RETURNING id", UUID.class);
    }

    @Test
    void anEmptyDatabaseGivesZeroEverywhere() throws Exception {
        var a = data(call(ADMIN, adminToken).andExpect(status().isOk()));
        assertThat(a.at("/users/total").asLong()).isEqualTo(3);
        assertThat(a.at("/users/active").asLong()).isEqualTo(3);
        for (var path : new String[] {"/users/locked", "/authors/approved", "/authors/suspended", "/authors/pendingApplications",
                "/content/articles", "/content/courses", "/content/exerciseSets", "/content/interviewQuestions",
                "/content/forumQuestions", "/orders/awaitingConfirmation", "/orders/needsReconciliation",
                "/revenue/allTime/paidOrders", "/revenue/allTime/grossAmount", "/revenue/allTime/platformAmount",
                "/revenue/allTime/authorAmount", "/revenue/last30Days/paidOrders", "/revenue/last30Days/grossAmount"}) {
            assertThat(a.at(path).isNumber()).as(path).isTrue();
            assertThat(a.at(path).asLong()).as(path).isZero();
        }
        var m = data(call(MOD, modToken).andExpect(status().isOk()));
        for (var path : new String[] {"/pending/articles", "/pending/courses", "/pending/exerciseSets",
                "/pending/interviewQuestions", "/reports/open", "/reports/hiddenPosts"}) {
            assertThat(m.at(path).isNumber()).as(path).isTrue();
            assertThat(m.at(path).asLong()).as(path).isZero();
        }
    }

    @Test
    void countsFollowTheSourceRules() throws Exception {
        UUID approved = user("author@example.com", "AUTHOR");
        profile(approved, "APPROVED");
        UUID suspended = user("suspended@example.com", "AUTHOR");
        profile(suspended, "SUSPENDED");
        profile(user("applicant@example.com"), "PENDING");
        UUID locked = user("locked@example.com");
        jdbc.update("UPDATE techverse.users SET is_active = false WHERE id = ?", locked);
        jdbc.update("UPDATE techverse.users SET created_at = now() - interval '7 days 1 hour' WHERE id = ?", user("old@example.com"));
        jdbc.update("UPDATE techverse.users SET created_at = now() - interval '6 days 23 hours' WHERE id = ?", user("edge@example.com"));
        // Past the reference time: counted in the total, not in the 7-day window.
        jdbc.update("UPDATE techverse.users SET created_at = now() + interval '1 hour' WHERE id = ?", user("future@example.com"));

        publishedArticle(approved);
        publishedArticle(suspended); // the author is suspended, the article still counts
        article(approved, "PENDING");
        article(approved, "DRAFT");
        publishedCourse(approved, 0);
        course(approved, "PENDING");
        course(suspended, "PENDING");
        exercise(approved, "PUBLISHED");
        exercise(approved, "PENDING");
        exercise(approved, "DRAFT");
        interview(approved, "PUBLISHED");
        interview(approved, "PUBLISHED");
        interview(approved, "PENDING");
        UUID q1 = question(approved, "VISIBLE");
        question(approved, "VISIBLE");
        UUID hiddenQuestion = question(approved, "HIDDEN");
        answer(locked, q1, "VISIBLE");
        answer(locked, q1, "HIDDEN");
        report(admin, q1, "OPEN");
        report(mod, q1, "OPEN");
        report(admin, hiddenQuestion, "DISMISSED");

        var a = data(call(ADMIN, adminToken).andExpect(status().isOk()));
        assertThat(a.path("users").toString()).isEqualTo("{\"total\":10,\"active\":9,\"locked\":1,\"newLast7Days\":8}");
        assertThat(a.path("authors").toString()).isEqualTo("{\"approved\":1,\"suspended\":1,\"pendingApplications\":1}");
        assertThat(a.path("content").toString()).isEqualTo(
                "{\"articles\":2,\"courses\":1,\"exerciseSets\":1,\"interviewQuestions\":2,\"forumQuestions\":2}");

        var m = data(call(MOD, modToken).andExpect(status().isOk()));
        assertThat(m.toString()).isEqualTo("{\"pending\":{\"articles\":1,\"courses\":2,\"exerciseSets\":1,\"interviewQuestions\":1},"
                + "\"reports\":{\"open\":2,\"hiddenPosts\":2}}");
        // Same numbers as the "pending" filter of the two review queues.
        assertThat(data(call("/api/v1/moderator/articles?workflowStatus=PENDING", modToken).andExpect(status().isOk()))
                .path("totalElements").asLong()).isEqualTo(m.at("/pending/articles").asLong());
        assertThat(data(call("/api/v1/moderator/courses?workflowStatus=PENDING", modToken).andExpect(status().isOk()))
                .path("totalElements").asLong()).isEqualTo(m.at("/pending/courses").asLong());
    }

    @Test
    void revenueCountsPaidOrdersOnceFromTheirItems() throws Exception {
        UUID author = user("author@example.com", "AUTHOR");
        profile(author, "APPROVED");
        UUID buyer = user("buyer@example.com");
        UUID course = publishedCourse(author, 100_000);
        UUID policy = jdbc.queryForObject("INSERT INTO techverse.commission_policies (rate_bps) VALUES (2000) RETURNING id", UUID.class);

        UUID twoPayments = order(buyer, "PAID", "now() - interval '1 day'", false, false, course, policy, 100_000);
        payment(twoPayments);
        payment(twoPayments);
        order(buyer, "PAID", "now() - interval '29 days 23 hours'", false, false, course, policy, 100_000); // same course again
        order(buyer, "PAID", "now() - interval '30 days 1 hour'", false, false, course, policy, 200_000);
        order(buyer, "PAID", "now() - interval '40 days'", true, true, course, policy, 50_000);
        order(buyer, "PAID", "now() + interval '1 hour'", false, false, course, policy, 30_000); // all-time only
        order(buyer, "EXPIRED", null, true, false, course, policy, 100_000);
        order(buyer, "PENDING", null, true, false, course, policy, 100_000);
        order(buyer, "PENDING", null, false, false, course, policy, 100_000);
        order(buyer, "CANCELLED", null, true, false, course, policy, 100_000);

        var a = data(call(ADMIN, adminToken).andExpect(status().isOk()));
        // The second payment on a PAID order raises its reconciliation flag (V15 trigger): two flagged orders.
        assertThat(a.path("orders").toString()).isEqualTo("{\"awaitingConfirmation\":2,\"needsReconciliation\":2}");
        assertThat(a.at("/revenue/allTime").toString())
                .isEqualTo("{\"paidOrders\":5,\"grossAmount\":480000,\"platformAmount\":96000,\"authorAmount\":384000}");
        assertThat(a.at("/revenue/last30Days").toString())
                .isEqualTo("{\"paidOrders\":2,\"grossAmount\":200000,\"platformAmount\":40000,\"authorAmount\":160000}");
    }

    @Test
    void eachEndpointNeedsItsOwnActiveRole() throws Exception {
        call(ADMIN, null).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_ACCESS_TOKEN_REQUIRED"));
        call(MOD, "not-a-token").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTH_INVALID_ACCESS_TOKEN"));
        call(ADMIN, modToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        call(MOD, adminToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        call(ADMIN + "?days=7", bothToken).andExpect(status().isOk()).andExpect(jsonPath("$.data.revenue").exists());
        call(MOD, bothToken).andExpect(status().isOk()).andExpect(jsonPath("$.data.revenue").doesNotExist());

        jdbc.update("UPDATE techverse.users SET is_active = false WHERE id = ?", both);
        call(ADMIN, bothToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        call(MOD, bothToken).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    // ------------------------------------------------------------------ data

    UUID user(String email, String... roles) {
        UUID id = users.saveAndFlush(User.createLocalAccount("User " + email, email, encoder.encode("SecurePass123!"))).getId();
        for (String role : roles)
            jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name=?", id, role);
        return id;
    }

    void profile(UUID user, String status) {
        jdbc.update("INSERT INTO techverse.author_profiles(user_id,bio,expertise,status) VALUES (?,'Bio','Java',?)", user, status);
    }

    UUID article(UUID author, String workflow) {
        return jdbc.queryForObject("INSERT INTO techverse.articles(author_id,topic_id,title,summary,content,content_fingerprint,workflow_status)"
                + " VALUES (?,?,'Article','Summary','Content',repeat('0',64),?) RETURNING id", UUID.class, author, topic, workflow);
    }

    void publishedArticle(UUID author) {
        UUID id = article(author, "DRAFT");
        UUID version = jdbc.queryForObject("INSERT INTO techverse.article_publication_versions(article_id,version_number,title,summary,content,"
                + "topic_id,content_fingerprint,reading_minutes,approved_at) VALUES (?,1,'Article','Summary','Content',?,repeat('0',64),1,now())"
                + " RETURNING id", UUID.class, id, topic);
        jdbc.update("UPDATE techverse.articles SET workflow_status='PUBLISHED', publication_status='PUBLISHED', published_version_id=?,"
                + " published_at=now() WHERE id=?", version, id);
    }

    UUID course(UUID author, String workflow) {
        return jdbc.queryForObject("INSERT INTO techverse.courses(author_id,topic_id,title,summary,description,level,content_fingerprint,workflow_status)"
                + " VALUES (?,?,'Course','Summary','Description','BEGINNER',repeat('0',64),?) RETURNING id", UUID.class, author, topic, workflow);
    }

    UUID publishedCourse(UUID author, long price) {
        UUID id = course(author, "DRAFT");
        UUID version = jdbc.queryForObject("INSERT INTO techverse.course_publication_versions(course_id,version_number,title,summary,description,"
                + "level,topic_id,content_fingerprint,approved_at) VALUES (?,1,'Course','Summary','Description','BEGINNER',?,repeat('0',64),now())"
                + " RETURNING id", UUID.class, id, topic);
        jdbc.update("UPDATE techverse.courses SET workflow_status='PUBLISHED', publication_status='PUBLISHED', published_version_id=?,"
                + " published_at=now(), price_amount=? WHERE id=?", version, price, id);
        return id;
    }

    void exercise(UUID author, String status) {
        jdbc.update("INSERT INTO techverse.exercise_sets(author_id,topic_id,title,description,exercise_type,difficulty,status,published_at)"
                + " VALUES (?,?,'Exercises','Description','MULTIPLE_CHOICE','EASY',?,CASE WHEN ?='PUBLISHED' THEN now() END)",
                author, topic, status, status);
    }

    void interview(UUID author, String status) {
        jdbc.update("INSERT INTO techverse.interview_questions(author_id,topic_id,level,question,sample_answer,status,published_at)"
                + " VALUES (?,?,'EASY','Question','Answer',?,CASE WHEN ?='PUBLISHED' THEN now() END)", author, topic, status, status);
    }

    UUID question(UUID author, String status) {
        return jdbc.queryForObject("INSERT INTO techverse.forum_posts(user_id,topic_id,title,content,status) VALUES (?,?,'Title','Content',?)"
                + " RETURNING id", UUID.class, author, topic, status);
    }

    void answer(UUID author, UUID question, String status) {
        jdbc.update("INSERT INTO techverse.forum_posts(user_id,parent_id,content,status) VALUES (?,?,'Answer',?)", author, question, status);
    }

    void report(UUID reporter, UUID post, String status) {
        jdbc.update("INSERT INTO techverse.reports(reporter_id,target_type,target_id,reason,status) VALUES (?,'FORUM_POST',?,'SPAM',?)",
                reporter, post, status);
    }

    UUID order(UUID buyer, String status, String paidAt, boolean reported, boolean reconcile, UUID course, UUID policy, long price) {
        UUID id = jdbc.queryForObject("INSERT INTO techverse.orders(user_id,order_code,total_amount,status,paid_at,transfer_reported_at,"
                + "needs_reconciliation) VALUES (?,'TV'||nextval('techverse.order_code_seq'),0,?," + (paidAt == null ? "NULL" : paidAt)
                + "," + (reported ? "now()" : "NULL") + ",?) RETURNING id", UUID.class, buyer, status, reconcile);
        // The item insert refreshes orders.total_amount through a trigger.
        jdbc.update("INSERT INTO techverse.order_items(order_id,course_id,course_title_snapshot,unit_price_amount,commission_policy_id,"
                + "commission_rate_bps,commission_amount,author_net_amount) VALUES (?,?,'Course',?,?,0,0,?)", id, course, price, policy, price);
        return id;
    }

    void payment(UUID order) {
        jdbc.update("INSERT INTO techverse.payment_transactions(order_id,provider,amount,status,paid_at)"
                + " SELECT id,'MANUAL',total_amount,'SUCCEEDED',now() FROM techverse.orders WHERE id=?", order);
    }

    // ------------------------------------------------------------------ http

    ResultActions call(String path, String token) throws Exception {
        var request = get(path);
        if (token != null) request.header("Authorization", "Bearer " + token);
        return mvc.perform(request);
    }

    JsonNode data(ResultActions result) throws Exception {
        return mapper.readTree(result.andReturn().getResponse().getContentAsString()).path("data");
    }

    String login(String email) throws Exception {
        var r = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", "SecurePass123!"))))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(r.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }
}
