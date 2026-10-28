package com.techverse.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.ArgumentMatchers.any;

import com.techverse.server.entity.User;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.EmailService;
import com.techverse.server.service.TokenService;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
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
class PasswordResetIntegrationTest {
    private static final String EMAIL = "reset.user@example.com";
    private static final String OLD_PASSWORD = "SecurePass123!";
    private static final String NEW_PASSWORD = "NewSecurePass456!";
    private static final String ROOT = "/api/v1/auth";

    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));
    @Container @ServiceConnection(name = "redis")
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    @Autowired StringRedisTemplate cache;
    @MockitoBean EmailService emailService;
    @MockitoSpyBean TokenService tokenService;
    private final BlockingQueue<SentMail> mailbox = new LinkedBlockingQueue<>();

    @BeforeEach
    void setUp() {
        try (var connection = cache.getConnectionFactory().getConnection()) {
            connection.serverCommands().flushDb(); // Only this class's disposable Testcontainers Redis.
        }
        mailbox.clear();
        users.deleteAll();
        User user = User.createLocalAccount("Reset User", EMAIL, encoder.encode(OLD_PASSWORD));
        users.saveAndFlush(user);
        doAnswer(invocation -> {
            mailbox.add(new SentMail(invocation.getArgument(0), invocation.getArgument(1),
                    Map.copyOf(invocation.<Map<String, Object>>getArgument(2))));
            return null;
        }).when(emailService).sendEmailBySendGrid(anyString(), anyString(), anyMap());
    }

    @Test
    void issuesSixDigitOtpAndSeparateGrantWithTenMinuteTtlThenRevokesEverySession() throws Exception {
        MvcResult firstLogin = login(OLD_PASSWORD);
        MvcResult secondLogin = login(OLD_PASSWORD);
        SentMail mail = requestOtp();
        String otp = mail.data().get("otp").toString();
        assertThat(mail.template()).isEqualTo("reset-password-otp");
        assertThat(mail.email()).isEqualTo(EMAIL);
        assertThat(otp).matches("[0-9]{6}");
        String state = onlyKey("state");
        assertThat(cache.getExpire(state)).isBetween(590L, 600L);
        assertThat(cache.opsForHash().values(state)).doesNotContain(otp);
        String grant = grantFor(otp);
        assertThat(grant).matches("[A-Za-z0-9_-]{43}");
        assertThat(cache.getExpire(onlyKey("ticket"))).isBetween(590L, 600L);
        assertThat(cache.getExpire(state)).isBetween(590L, 600L);
        assertThat(cache.keys("auth:password-reset:*"))
                .noneMatch(key -> key.contains(grant) || key.contains(EMAIL));

        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
        assertThat(encoder.matches(NEW_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPassword())).isTrue();
        for (MvcResult session : List.of(firstLogin, secondLogin)) {
            String access = mapper.readTree(session.getResponse().getContentAsString()).at("/data/accessToken").asText();
            mvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + access))
                    .andExpect(status().isUnauthorized());
            mvc.perform(post(ROOT + "/refresh").cookie(session.getResponse().getCookie("refresh_token")))
                    .andExpect(status().isUnauthorized());
        }
        reset(grant, OLD_PASSWORD, OLD_PASSWORD).andExpect(status().isUnauthorized());
        verify(otp).andExpect(status().isUnauthorized());
        login(OLD_PASSWORD, 401);
        login(NEW_PASSWORD, 200);
    }

    @Test
    void invalidPasswordAndConfirmationDoNotConsumeGrant() throws Exception {
        String grant = grantFor(requestOtp().data().get("otp").toString());
        reset(grant, NEW_PASSWORD, "DifferentPassword!").andExpect(status().isBadRequest());
        reset(grant, "short", "short").andExpect(status().isBadRequest());
        reset(grant, "ắ".repeat(30), "ắ".repeat(30)).andExpect(status().isBadRequest());
        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void simultaneousOtpVerificationHasExactlyOneWinner() throws Exception {
        String otp = requestOtp().data().get("otp").toString();
        List<MvcResult> results = parallel(8, index -> verify(otp).andReturn());
        assertThat(results.stream().filter(r -> r.getResponse().getStatus() == 200).count()).isEqualTo(1);
        assertThat(results.stream().filter(r -> r.getResponse().getStatus() == 401).count()).isEqualTo(7);
        String grant = mapper.readTree(results.stream().filter(r -> r.getResponse().getStatus() == 200)
                .findFirst().orElseThrow().getResponse().getContentAsString()).at("/data/resetToken").asText();
        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void simultaneousResetHasExactlyOnePasswordWriter() throws Exception {
        String grant = grantFor(requestOtp().data().get("otp").toString());
        List<MvcResult> results = parallel(8, index -> reset(grant, "WinnerPassword!" + index,
                "WinnerPassword!" + index).andReturn());
        assertThat(results.stream().filter(r -> r.getResponse().getStatus() == 200).count()).isEqualTo(1);
        assertThat(results.stream().filter(r -> r.getResponse().getStatus() == 401).count()).isEqualTo(7);
        String stored = users.findByEmail(EMAIL).orElseThrow().getPassword();
        for (int index = 0; index < results.size(); index++) {
            assertThat(encoder.matches("WinnerPassword!" + index, stored))
                    .isEqualTo(results.get(index).getResponse().getStatus() == 200);
        }
    }

    @Test
    void expiredOtpCannotBeVerified() throws Exception {
        String otp = requestOtp().data().get("otp").toString();
        cache.expire(onlyKey("state"), Duration.ZERO);
        verify(otp).andExpect(status().isUnauthorized());
    }

    @Test
    void expiredGrantCannotChangePassword() throws Exception {
        String grant = grantFor(requestOtp().data().get("otp").toString());
        cache.expire(onlyKey("ticket"), Duration.ZERO);
        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
        login(OLD_PASSWORD, 200);
    }

    @Test
    void fiveWrongCodesInvalidateEvenTheCorrectOtp() throws Exception {
        String otp = requestOtp().data().get("otp").toString();
        String wrong = otp.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) verify(wrong).andExpect(status().isUnauthorized());
        verify(otp).andExpect(status().isUnauthorized());
    }

    @Test
    void repeatedForgotDuringCooldownDoesNotReplaceOtp() throws Exception {
        String otp = requestOtp().data().get("otp").toString();
        forgot(EMAIL).andExpect(status().isOk());
        assertThat(mailbox.poll(200, TimeUnit.MILLISECONDS)).isNull();
        verify(otp).andExpect(status().isOk());
    }

    @Test
    void resendInvalidatesPreviouslyVerifiedGrant() throws Exception {
        String grant = grantFor(requestOtp().data().get("otp").toString());
        cache.delete(onlyKey("cooldown"));
        String newOtp = requestOtp().data().get("otp").toString();
        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
        reset(grantFor(newOtp), NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void missingSocialAndInactiveAccountsHaveSameForgotResponseAndNoEmail() throws Exception {
        String expected = forgot(EMAIL).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(mailbox.poll(5, TimeUnit.SECONDS)).isNotNull();
        User social = User.createSocialAccount("Google User", "google@example.com");
        users.saveAndFlush(social);
        User inactive = User.createLocalAccount("Locked", "locked@example.com", encoder.encode(OLD_PASSWORD));
        inactive.updateActiveStatus(false);
        users.saveAndFlush(inactive);
        for (String email : List.of("missing@example.com", "google@example.com", "locked@example.com")) {
            assertThat(forgot(email).andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                    .isEqualTo(expected);
        }
        assertThat(mailbox.poll(200, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void lockingAccountAfterVerificationPreventsReset() throws Exception {
        String grant = grantFor(requestOtp().data().get("otp").toString());
        User user = users.findByEmail(EMAIL).orElseThrow();
        user.updateActiveStatus(false);
        users.saveAndFlush(user);
        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
        assertThat(encoder.matches(OLD_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPassword())).isTrue();
    }

    @Test
    void rejectsMalformedPayloadsAndNeverAcceptsOtpAsResetGrant() throws Exception {
        forgot("not-an-email").andExpect(status().isBadRequest());
        verify("12345").andExpect(status().isBadRequest());
        verify("abcdef").andExpect(status().isBadRequest());
        String otp = requestOtp().data().get("otp").toString();
        reset(otp, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isBadRequest());
        reset("a".repeat(43), NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void resendingDoesNotResetVerificationBudget() throws Exception {
        for (int round = 0; round < 3; round++) {
            if (round > 0) cache.delete(onlyKey("cooldown"));
            String otp = requestOtp().data().get("otp").toString();
            String wrong = otp.equals("000000") ? "111111" : "000000";
            int attempts = round < 2 ? 4 : 2;
            for (int i = 0; i < attempts; i++) verify(wrong).andExpect(status().isUnauthorized());
            if (round == 2) verify(otp).andExpect(status().isTooManyRequests());
        }
    }

    @Test
    void limitsSendsPerEmailWithoutDisclosingAccountExistence() throws Exception {
        for (int i = 0; i < 5; i++) {
            if (i > 0) cache.delete(onlyKey("cooldown"));
            requestOtp();
        }
        cache.delete(onlyKey("cooldown"));
        forgot(EMAIL).andExpect(status().isOk());
        assertThat(mailbox.poll(200, TimeUnit.MILLISECONDS)).isNull();
    }

    @Test
    void limitsForgotRequestsPerIpEvenForUnknownEmails() throws Exception {
        for (int i = 0; i < 30; i++) forgot("missing" + i + "@example.com").andExpect(status().isOk());
        forgot("missing31@example.com").andExpect(status().isTooManyRequests());
    }

    @Test
    void sessionRevocationFailureRollsBackPasswordAndDoesNotRestoreConsumedGrant() throws Exception {
        String grant = grantFor(requestOtp().data().get("otp").toString());
        doThrow(new IllegalStateException("Simulated session store failure"))
                .when(tokenService).deleteAllTokensByUserId(any(java.util.UUID.class));
        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isInternalServerError());
        assertThat(encoder.matches(OLD_PASSWORD, users.findByEmail(EMAIL).orElseThrow().getPassword())).isTrue();
        reset(grant, NEW_PASSWORD, NEW_PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRacingResetCannotLeaveAValidOldSession() throws Exception {
        MvcResult session = login(OLD_PASSWORD);
        String grant = grantFor(requestOtp().data().get("otp").toString());
        Cookie cookie = session.getResponse().getCookie("refresh_token");
        List<MvcResult> results = parallel(2, index -> index == 0
                ? reset(grant, NEW_PASSWORD, NEW_PASSWORD).andReturn()
                : mvc.perform(post(ROOT + "/refresh").cookie(cookie)).andReturn());
        assertThat(results.get(0).getResponse().getStatus()).isEqualTo(200);
        assertThat(results.get(1).getResponse().getStatus()).isIn(200, 401);
        if (results.get(1).getResponse().getStatus() == 200) {
            String access = mapper.readTree(results.get(1).getResponse().getContentAsString())
                    .at("/data/accessToken").asText();
            mvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + access))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(post(ROOT + "/refresh").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test
    void oldPasswordLoginRacingResetCannotLeaveAValidSession() throws Exception {
        String grant = grantFor(requestOtp().data().get("otp").toString());
        List<MvcResult> results = parallel(2, index -> index == 0
                ? reset(grant, NEW_PASSWORD, NEW_PASSWORD).andReturn()
                : mvc.perform(post(ROOT + "/login").contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("email", EMAIL, "password", OLD_PASSWORD))))
                        .andReturn());
        assertThat(results.get(0).getResponse().getStatus()).isEqualTo(200);
        assertThat(results.get(1).getResponse().getStatus()).isIn(200, 401);
        if (results.get(1).getResponse().getStatus() == 200) {
            String access = mapper.readTree(results.get(1).getResponse().getContentAsString())
                    .at("/data/accessToken").asText();
            mvc.perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + access))
                    .andExpect(status().isUnauthorized());
        }
        login(OLD_PASSWORD, 401);
        login(NEW_PASSWORD, 200);
    }

    private SentMail requestOtp() throws Exception {
        forgot(EMAIL).andExpect(status().isOk()).andExpect(jsonPath("$.data.resetToken").doesNotExist());
        SentMail sent = mailbox.poll(5, TimeUnit.SECONDS);
        assertThat(sent).as("OTP sent through the asynchronous email listener").isNotNull();
        return sent;
    }

    private org.springframework.test.web.servlet.ResultActions forgot(String email) throws Exception {
        return mvc.perform(post(ROOT + "/forgot-password").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("email", email))));
    }

    private org.springframework.test.web.servlet.ResultActions verify(String otp) throws Exception {
        return mvc.perform(post(ROOT + "/verify-reset-otp").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("email", EMAIL, "otp", otp))));
    }

    private String grantFor(String otp) throws Exception {
        return mapper.readTree(verify(otp).andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .at("/data/resetToken").asText();
    }

    private org.springframework.test.web.servlet.ResultActions reset(String token, String password, String confirm)
            throws Exception {
        return mvc.perform(post(ROOT + "/reset-password").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("resetToken", token,
                        "newPassword", password, "confirmPassword", confirm))));
    }

    private MvcResult login(String password) throws Exception { return login(password, 200); }

    private MvcResult login(String password, int expected) throws Exception {
        return mvc.perform(post(ROOT + "/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(Map.of("email", EMAIL, "password", password))))
                .andExpect(status().is(expected)).andReturn();
    }

    private String onlyKey(String type) {
        var keys = cache.keys("auth:password-reset:" + type + ":*");
        assertThat(keys).hasSize(1);
        return keys.iterator().next();
    }

    private List<MvcResult> parallel(int count, CheckedRequest request) throws Exception {
        try (var pool = Executors.newFixedThreadPool(count)) {
            CountDownLatch ready = new CountDownLatch(count);
            CountDownLatch start = new CountDownLatch(1);
            var futures = new ArrayList<java.util.concurrent.Future<MvcResult>>();
            for (int i = 0; i < count; i++) {
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
    private record SentMail(String email, String template, Map<String, Object> data) { }
}
