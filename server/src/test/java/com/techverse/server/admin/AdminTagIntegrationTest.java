package com.techverse.server.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.entity.User;
import com.techverse.server.repository.TokenRepository;
import com.techverse.server.repository.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.ObjectMapper;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminTagIntegrationTest {
    private static final String ROOT = "/api/v1/admin/tags";
    private static final String PASSWORD = "SecurePass123!";

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
    @Container @ServiceConnection(name = "redis")
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired TokenRepository tokens;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    private UUID adminId;
    private UUID secondAdminId;
    private UUID learnerId;
    private String adminToken;
    private String secondAdminToken;

    @BeforeEach
    void setUp() throws Exception {
        tokens.deleteAll();
        // All data lives in this test class's disposable PostgreSQL container.
        jdbc.execute("TRUNCATE techverse.topics, techverse.tags CASCADE");
        users.deleteAll();
        String passwordHash = encoder.encode(PASSWORD);
        adminId = users.saveAndFlush(User.createLocalAccount("Tag Admin", "tag.admin@example.com", passwordHash)).getId();
        secondAdminId = users.saveAndFlush(User.createLocalAccount("Second Admin", "tag.second@example.com", passwordHash)).getId();
        learnerId = users.saveAndFlush(User.createLocalAccount("Learner", "tag.learner@example.com", passwordHash)).getId();
        assignRole(adminId, "ADMIN");
        assignRole(secondAdminId, "ADMIN");
        adminToken = login("tag.admin@example.com");
        secondAdminToken = login("tag.second@example.com");
    }

    @Test
    void createNormalizesDefaultsAndUsesAuthenticatedAuditInsteadOfPayload() throws Exception {
        MvcResult result = create(adminToken, Map.of("name", "  Backend  ", "description", "  Server engineering  ",
                        "active", false, "createdBy", learnerId.toString(), "id", learnerId.toString()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value(201))
                .andExpect(jsonPath("$.data.name").value("Backend"))
                .andExpect(jsonPath("$.data.description").value("Server engineering"))
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.data.createdBy").value(adminId.toString()))
                .andExpect(jsonPath("$.data.updatedBy").value(adminId.toString()))
                .andExpect(jsonPath("$.data.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.data.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.version").doesNotExist()).andReturn();
        UUID id = idOf(result);
        assertThat(id).isNotEqualTo(learnerId);
        detail(id).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Backend"));
        create(adminToken, Map.of("name", "Frontend")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.description").isEmpty());
    }

    @Test
    void duplicateNamesAreCaseInsensitiveAndReservedEvenWhenInactive() throws Exception {
        UUID id = newTag("Backend", "Description");
        changeStatus(adminToken, id, false).andExpect(status().isOk());
        create(adminToken, Map.of("name", " backend ")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TAG_EXISTED"));
        UUID other = newTag("Frontend", "Other");
        update(adminToken, other, Map.of("name", "BACKEND")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TAG_EXISTED"));
        detail(other).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Frontend"));
        update(adminToken, id, Map.of("name", "BACKEND")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("BACKEND"));
    }

    @Test
    void patchPreservesAbsentFieldsClearsExplicitNullAndDoesNotAcceptStatusOrAuditChanges() throws Exception {
        UUID id = newTag("Backend", "Original description");
        update(secondAdminToken, id, Map.of("name", "  Backend Development  ", "active", false,
                        "createdBy", learnerId.toString(), "updatedBy", learnerId.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Backend Development"))
                .andExpect(jsonPath("$.data.description").value("Original description"))
                .andExpect(jsonPath("$.data.active").value(true))
                .andExpect(jsonPath("$.data.createdBy").value(adminId.toString()))
                .andExpect(jsonPath("$.data.updatedBy").value(secondAdminId.toString()));
        update(adminToken, id, Map.of("description", "  Updated description  ")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("Backend Development"))
                .andExpect(jsonPath("$.data.description").value("Updated description"));
        sendPatch(ROOT + "/" + id, adminToken, "{\"description\":null}").andExpect(status().isOk())
                .andExpect(jsonPath("$.data.description").isEmpty())
                .andExpect(jsonPath("$.data.name").value("Backend Development"));
        changeStatus(adminToken, id, false).andExpect(status().isOk());
        update(adminToken, id, Map.of("description", "Inactive tags may be edited")).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));
    }

    @Test
    void createRejectsInvalidNamesAndOversizedDescriptionsButAcceptsBoundaries() throws Exception {
        for (String body : List.of("{}", "{\"name\":null}", "{\"name\":\"  \"}",
                mapper.writeValueAsString(Map.of("name", "x".repeat(101))),
                mapper.writeValueAsString(Map.of("name", "Valid", "description", "x".repeat(501))))) {
            createRaw(adminToken, body).andExpect(status().isBadRequest());
        }
        create(adminToken, Map.of("name", "x".repeat(100), "description", "d".repeat(500)))
                .andExpect(status().isCreated());
    }

    @Test
    void patchRejectsEmptyUnsupportedNullNameBlankNameAndOversizedValues() throws Exception {
        UUID id = newTag("Backend", "Original");
        for (String body : List.of("{}", "{\"active\":false}", "{\"name\":null}", "{\"name\":\"  \"}",
                mapper.writeValueAsString(Map.of("name", "x".repeat(101))),
                mapper.writeValueAsString(Map.of("description", "x".repeat(501))))) {
            sendPatch(ROOT + "/" + id, adminToken, body).andExpect(status().isBadRequest());
        }
        detail(id).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Backend"))
                .andExpect(jsonPath("$.data.description").value("Original"));
    }

    @Test
    void statusRequiresNonNullBooleanAndRepeatedStatusIsAnIdempotentNoop() throws Exception {
        UUID id = newTag("Backend", "Original");
        for (String body : List.of("{}", "{\"active\":null}", "{\"active\":\"not-boolean\"}")) {
            sendPatch(ROOT + "/" + id + "/status", adminToken, body).andExpect(status().isBadRequest());
        }
        changeStatus(secondAdminToken, id, false).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false))
                .andExpect(jsonPath("$.data.updatedBy").value(secondAdminId.toString()));
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM techverse.tags WHERE id=?", id);
        changeStatus(adminToken, id, false).andExpect(status().isOk());
        assertThat(jdbc.queryForMap("SELECT * FROM techverse.tags WHERE id=?", id)).isEqualTo(before);
        changeStatus(adminToken, id, true).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(true));
    }

    @Test
    void listFiltersCaseInsensitivelyAndPaginatesWithStableTiesAndWhitelistSorts() throws Exception {
        UUID java = newTag("Java", "JVM");
        UUID javascript = newTag("JavaScript", "Web");
        newTag("Python", "Data");
        changeStatus(adminToken, javascript, false).andExpect(status().isOk());
        list().andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.page").value(0)).andExpect(jsonPath("$.data.size").value(20));
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                        .param("keyword", "  JAVA  ").param("active", "true"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(java.toString()));
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).param("active", "false"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(javascript.toString()));
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).param("sortBy", "NAME")
                        .param("direction", "ASC").param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.content[0].name").value("JavaScript"))
                .andExpect(jsonPath("$.data.totalPages").value(3)).andExpect(jsonPath("$.data.hasNext").value(true));
        jdbc.update("UPDATE techverse.tags SET created_at='2026-01-01T00:00:00Z'");
        List<String> expected = jdbc.queryForList("SELECT id::text FROM techverse.tags ORDER BY id DESC", String.class);
        MvcResult tied = list().andExpect(status().isOk()).andReturn();
        List<String> actual = new ArrayList<>();
        mapper.readTree(tied.getResponse().getContentAsString()).at("/data/content")
                .forEach(node -> actual.add(node.get("id").asText()));
        assertThat(actual).containsExactlyElementsOf(expected);
        update(adminToken, java, Map.of("description", "Updated most recently")).andExpect(status().isOk());
        mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).param("sortBy", "UPDATED_AT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.content[0].id").value(java.toString()));
    }

    @Test
    void keywordTreatsSqlWildcardsAsLiteralCharacters() throws Exception {
        newTag("100% Java", "Percent");
        newTag("java_core", "Underscore");
        newTag("C:\\Java", "Slash");
        newTag("Unrelated", "Other");
        for (String keyword : List.of("%", "_", "\\")) {
            mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)).param("keyword", keyword))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        }
    }

    @Test
    void listRejectsInvalidFiltersAndReturnsEmptyPageForNoMatches() throws Exception {
        for (Map<String, String> params : List.of(Map.of("page", "-1"), Map.of("size", "0"), Map.of("size", "101"),
                Map.of("active", "maybe"), Map.of("sortBy", "PASSWORD"), Map.of("direction", "SIDEWAYS"),
                Map.of("keyword", "x".repeat(101)))) {
            var request = get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken));
            params.forEach(request::param);
            mvc.perform(request).andExpect(status().isBadRequest());
        }
        list().andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(0))
                .andExpect(jsonPath("$.data.content").isEmpty());
    }

    @Test
    void allFiveEndpointsRequireAuthenticationAndAdminRole() throws Exception {
        UUID id = newTag("Backend", "Original");
        for (String token : new String[] {null, "invalid-token"}) {
            assertEndpoints(token, id, 401);
        }
        assertEndpoints(login("tag.learner@example.com"), id, 403);
        assignRole(learnerId, "MODERATOR");
        assertEndpoints(login("tag.learner@example.com"), id, 403);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.tags", Integer.class)).isEqualTo(1);
    }

    @Test
    void revokedAdminDatabaseMembershipCannotWriteWithOldAdminJwt() throws Exception {
        UUID id = newTag("Backend", "Original");
        jdbc.update("DELETE FROM techverse.user_roles WHERE user_id=? AND role_id IN (SELECT id FROM techverse.roles WHERE name='ADMIN')", adminId);
        create(adminToken, Map.of("name", "Unauthorized")).andExpect(status().isForbidden());
        update(adminToken, id, Map.of("name", "Unauthorized")).andExpect(status().isForbidden());
        changeStatus(adminToken, id, false).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT name::text FROM techverse.tags WHERE id=?", String.class, id)).isEqualTo("Backend");
    }

    @Test
    void malformedAndMissingIdsUseConsistentErrorsAndPublicRouteIsNotExposed() throws Exception {
        UUID missing = UUID.randomUUID();
        detail(missing).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));
        update(adminToken, missing, Map.of("name", "Missing")).andExpect(status().isNotFound());
        changeStatus(adminToken, missing, false).andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/not-a-uuid").header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isBadRequest());
        sendPatch(ROOT + "/not-a-uuid/status", adminToken, "{\"active\":false}").andExpect(status().isBadRequest());
        createRaw(adminToken, "{not-json}").andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/tags").header(HttpHeaders.AUTHORIZATION, bearer(adminToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void renameAndStatusChangesPreserveArticlesAndAllTagLinks() throws Exception {
        UUID id = newTag("Backend", "Shared tag");
        UUID other = newTag("Java", "Second tag");
        UUID topicId = jdbc.queryForObject("INSERT INTO techverse.topics(name) VALUES ('Article topic') RETURNING id", UUID.class);
        UUID articleId = jdbc.queryForObject("INSERT INTO techverse.articles(author_id,topic_id,title,summary,content,status,published_at) VALUES (?,?,'Article','Summary','Content','PUBLISHED',now()) RETURNING id", UUID.class, learnerId, topicId);
        jdbc.update("INSERT INTO techverse.article_tags(article_id,tag_id) VALUES (?,?),(?,?)", articleId, id, articleId, other);
        var articleBefore = jdbc.queryForMap("SELECT * FROM techverse.articles WHERE id=?", articleId);
        var linksBefore = jdbc.queryForList("SELECT * FROM techverse.article_tags ORDER BY id");
        update(adminToken, id, Map.of("name", "Backend Development")).andExpect(status().isOk());
        changeStatus(adminToken, id, false).andExpect(status().isOk());
        changeStatus(adminToken, id, true).andExpect(status().isOk());
        assertThat(jdbc.queryForMap("SELECT * FROM techverse.articles WHERE id=?", articleId)).isEqualTo(articleBefore);
        assertThat(jdbc.queryForList("SELECT * FROM techverse.article_tags ORDER BY id")).isEqualTo(linksBefore);
        assertThat(jdbc.queryForObject("SELECT t.name::text FROM techverse.tags t JOIN techverse.article_tags a ON a.tag_id=t.id WHERE a.article_id=? AND t.id=?", String.class, articleId, id)).isEqualTo("Backend Development");
    }

    @Test
    void mutationAuditTimestampsMatchPersistedDetail() throws Exception {
        MvcResult created = create(adminToken, Map.of("name", "Java")).andExpect(status().isCreated()).andReturn();
        UUID id = idOf(created);
        assertPersistedAudit(created, id);
        assertPersistedAudit(update(secondAdminToken, id, Map.of("description", "JVM")).andExpect(status().isOk()).andReturn(), id);
        assertPersistedAudit(changeStatus(secondAdminToken, id, false).andExpect(status().isOk()).andReturn(), id);
        assertPersistedAudit(changeStatus(adminToken, id, false).andExpect(status().isOk()).andReturn(), id);
    }

    private void assertPersistedAudit(MvcResult mutation, UUID id) throws Exception {
        var written = mapper.readTree(mutation.getResponse().getContentAsString()).get("data");
        var persisted = mapper.readTree(detail(id).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("data");
        for (String field : List.of("createdAt", "updatedAt", "createdBy", "updatedBy")) {
            assertThat(written.get(field)).as(field).isEqualTo(persisted.get(field));
        }
    }

    @Test
    void concurrentCaseInsensitiveCreatesHaveOnlyOneWinner() throws Exception {
        var results = parallel(index -> create(index == 0 ? adminToken : secondAdminToken,
                Map.of("name", index == 0 ? "Backend" : "BACKEND")).andReturn());
        assertThat(results.stream().map(result -> result.getResponse().getStatus()).toList())
                .containsExactlyInAnyOrder(201, 409);
        MvcResult conflict = results.stream().filter(result -> result.getResponse().getStatus() == 409).findFirst().orElseThrow();
        assertThat(mapper.readTree(conflict.getResponse().getContentAsString()).get("code").asText()).isEqualTo("TAG_EXISTED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.tags", Integer.class)).isEqualTo(1);
    }

    @Test
    void concurrentRenamesToSameNameHaveOnlyOneWinner() throws Exception {
        UUID first = newTag("First", "One");
        UUID second = newTag("Second", "Two");
        var results = parallel(index -> update(index == 0 ? adminToken : secondAdminToken,
                index == 0 ? first : second, Map.of("name", index == 0 ? "Shared" : "SHARED")).andReturn());
        assertThat(results.stream().map(result -> result.getResponse().getStatus()).toList())
                .containsExactlyInAnyOrder(200, 409);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM techverse.tags WHERE name='shared'", Integer.class)).isEqualTo(1);
    }

    @Test
    void concurrentStatusAndPartialEditsDoNotUndoIndependentFields() throws Exception {
        UUID id = newTag("Backend", "Original");
        var results = parallel(index -> index == 0
                ? update(adminToken, id, Map.of("name", "New name")).andReturn()
                : changeStatus(secondAdminToken, id, false).andReturn());
        assertThat(results.stream().map(result -> result.getResponse().getStatus()).toList()).containsOnly(200);
        detail(id).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("New name"))
                .andExpect(jsonPath("$.data.description").value("Original"))
                .andExpect(jsonPath("$.data.active").value(false));
        var edits = parallel(index -> update(index == 0 ? adminToken : secondAdminToken, id,
                index == 0 ? Map.of("name", "Final name") : Map.of("description", "Final description")).andReturn());
        assertThat(edits.stream().map(result -> result.getResponse().getStatus()).toList()).containsOnly(200);
        detail(id).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Final name"))
                .andExpect(jsonPath("$.data.description").value("Final description"))
                .andExpect(jsonPath("$.data.active").value(false));
    }

    @Test
    void databaseFailureRollsBackChangesAndDoesNotBecomeADuplicateNameError() throws Exception {
        UUID id = newTag("Backend", "Original");
        Map<String, Object> before = jdbc.queryForMap("SELECT * FROM techverse.tags WHERE id=?", id);
        jdbc.execute("""
                CREATE FUNCTION techverse.test_reject_tag_write() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN RAISE EXCEPTION 'simulated tag write failure'; END; $$
                """);
        jdbc.execute("CREATE TRIGGER test_reject_tag_write BEFORE INSERT OR UPDATE ON techverse.tags FOR EACH ROW EXECUTE FUNCTION techverse.test_reject_tag_write()");
        try {
            create(adminToken, Map.of("name", "Other")).andExpect(status().isInternalServerError());
            update(secondAdminToken, id, Map.of("name", "Changed")).andExpect(status().isInternalServerError());
            changeStatus(secondAdminToken, id, false).andExpect(status().isInternalServerError());
            assertThat(jdbc.queryForMap("SELECT * FROM techverse.tags WHERE id=?", id)).isEqualTo(before);
        } finally {
            jdbc.execute("DROP TRIGGER test_reject_tag_write ON techverse.tags");
            jdbc.execute("DROP FUNCTION techverse.test_reject_tag_write()");
        }
    }

    private void assertEndpoints(String token, UUID id, int expected) throws Exception {
        var listRequest = get(ROOT);
        var detailRequest = get(ROOT + "/" + id);
        if (token != null) {
            listRequest.header(HttpHeaders.AUTHORIZATION, bearer(token));
            detailRequest.header(HttpHeaders.AUTHORIZATION, bearer(token));
        }
        mvc.perform(listRequest).andExpect(status().is(expected));
        mvc.perform(detailRequest).andExpect(status().is(expected));
        create(token, Map.of("name", "Unauthorized")).andExpect(status().is(expected));
        update(token, id, Map.of("name", "Unauthorized")).andExpect(status().is(expected));
        changeStatus(token, id, false).andExpect(status().is(expected));
    }

    private void assignRole(UUID id, String role) {
        jdbc.update("INSERT INTO techverse.user_roles(user_id,role_id) SELECT ?,id FROM techverse.roles WHERE name=?", id, role);
    }

    private String login(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).at("/data/accessToken").asText();
    }

    private String bearer(String token) { return "Bearer " + token; }
    private UUID idOf(MvcResult result) throws Exception {
        return UUID.fromString(mapper.readTree(result.getResponse().getContentAsString()).at("/data/id").asText());
    }
    private UUID newTag(String name, String description) throws Exception {
        return idOf(create(adminToken, Map.of("name", name, "description", description)).andExpect(status().isCreated()).andReturn());
    }
    private ResultActions create(String token, Object body) throws Exception { return createRaw(token, mapper.writeValueAsString(body)); }
    private ResultActions createRaw(String token, String body) throws Exception {
        var request = post(ROOT).contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) request.header(HttpHeaders.AUTHORIZATION, bearer(token));
        return mvc.perform(request);
    }
    private ResultActions detail(UUID id) throws Exception {
        return mvc.perform(get(ROOT + "/" + id).header(HttpHeaders.AUTHORIZATION, bearer(adminToken)));
    }
    private ResultActions list() throws Exception { return mvc.perform(get(ROOT).header(HttpHeaders.AUTHORIZATION, bearer(adminToken))); }
    private ResultActions update(String token, UUID id, Object body) throws Exception {
        return sendPatch(ROOT + "/" + id, token, mapper.writeValueAsString(body));
    }
    private ResultActions changeStatus(String token, UUID id, boolean active) throws Exception {
        return sendPatch(ROOT + "/" + id + "/status", token, mapper.writeValueAsString(Map.of("active", active)));
    }
    private ResultActions sendPatch(String path, String token, String body) throws Exception {
        var request = patch(path).contentType(MediaType.APPLICATION_JSON).content(body);
        if (token != null) request.header(HttpHeaders.AUTHORIZATION, bearer(token));
        return mvc.perform(request);
    }
    private List<MvcResult> parallel(CheckedRequest request) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            var futures = new ArrayList<java.util.concurrent.Future<MvcResult>>();
            for (int i = 0; i < 2; i++) {
                int index = i;
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                    return request.run(index);
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var results = new ArrayList<MvcResult>();
            for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        }
    }
    @FunctionalInterface private interface CheckedRequest { MvcResult run(int index) throws Exception; }
}
