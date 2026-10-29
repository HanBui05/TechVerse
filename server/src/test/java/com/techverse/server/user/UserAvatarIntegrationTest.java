package com.techverse.server.user;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.techverse.server.entity.User;
import com.techverse.server.repository.UserRepository;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;

import tools.jackson.databind.ObjectMapper;

import java.util.*;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserAvatarIntegrationTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

    @Container
    @ServiceConnection(name = "redis")
    static GenericContainer<?> redis =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder encoder;
    UUID userId;
    String token;

    @BeforeEach
    void setup() throws Exception {
        jdbc.execute("TRUNCATE techverse.users CASCADE");
        jdbc.execute(
                "INSERT INTO techverse.roles(name) VALUES"
                    + " ('LEARNER'),('AUTHOR'),('ADMIN'),('MODERATOR')");
        userId =
                users.saveAndFlush(
                                User.createLocalAccount(
                                        "Avatar User",
                                        "avatar@example.com",
                                        encoder.encode("SecurePass123!")))
                        .getId();
        var result =
                mvc.perform(
                                post("/api/v1/auth/login")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"email\":\"avatar@example.com\",\"password\":\"SecurePass123!\"}"))
                        .andExpect(status().isOk())
                        .andReturn();
        token =
                mapper.readTree(result.getResponse().getContentAsString())
                        .at("/data/accessToken")
                        .asText();
    }

    @Test
    void registrationReturnsAndPersistsAUsableDefaultAvatarWithoutProviderCredentials()
            throws Exception {
        var result =
                mvc.perform(
                                post("/api/v1/auth/register")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"fullName\":\"New"
                                                    + " User\",\"email\":\"new.avatar@example.com\",\"password\":\"SecurePass123!\",\"confirmPassword\":\"SecurePass123!\"}"))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.data.avatarUrl").isNotEmpty())
                        .andReturn();
        String avatar =
                mapper.readTree(result.getResponse().getContentAsString())
                        .at("/data/avatarUrl")
                        .asText();
        assertThat(avatar).startsWith("data:image/png;base64,");
        assertThat(users.findByEmail("new.avatar@example.com").orElseThrow().getAvatarUrl())
                .isEqualTo(avatar);
        assertThat(
                        javax.imageio.ImageIO.read(
                                new java.io.ByteArrayInputStream(
                                        Base64.getDecoder().decode(avatar.substring(22)))))
                .isNotNull();
    }

    @Test
    void unsupportedAvatarIsRejectedWithoutChangingTheUser() throws Exception {
        upload("evil.svg", "image/svg+xml", "<svg/>".getBytes())
                .andExpect(status().isUnsupportedMediaType());
        assertThat(users.findById(userId).orElseThrow().getAvatarUrl()).isNull();
    }

    @Test
    void validUploadWithoutProviderCredentialsFailsWithoutChangingTheUser() throws Exception {
        upload("avatar.png", "image/png", png()).andExpect(status().isServiceUnavailable());
        assertThat(users.findById(userId).orElseThrow().getAvatarUrl()).isNull();
    }

    ResultActions upload(String name, String type, byte[] bytes) throws Exception {
        return mvc.perform(
                multipart("/api/v1/users/me/avatar")
                        .file(new MockMultipartFile("file", name, type, bytes))
                        .with(
                                request -> {
                                    request.setMethod("PATCH");
                                    return request;
                                })
                        .header("Authorization", "Bearer " + token));
    }

    static byte[] png() throws Exception {
        var out = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(
                new java.awt.image.BufferedImage(8, 8, java.awt.image.BufferedImage.TYPE_INT_RGB),
                "png",
                out);
        return out.toByteArray();
    }
}
