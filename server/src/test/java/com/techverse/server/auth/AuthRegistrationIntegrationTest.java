package com.techverse.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.techverse.server.entity.User;
import com.techverse.server.repository.UserRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.ObjectMapper;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthRegistrationIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void registersLearnerAndReturnsCreatedResponse() throws Exception {
		register("nguyen.van.a@example.com", "SecurePass123!", "SecurePass123!")
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.status").value(201))
				.andExpect(jsonPath("$.message").value("User registered successfully"))
				.andExpect(jsonPath("$.data.fullName").value("Nguyen Van A"))
				.andExpect(jsonPath("$.data.email").value("nguyen.van.a@example.com"))
				.andExpect(jsonPath("$.data.roles[0]").value("LEARNER"));

		User savedUser = userRepository.findByEmail("nguyen.van.a@example.com").orElseThrow();
		assertThat(savedUser.getPassword()).isNotEqualTo("SecurePass123!");
		assertThat(passwordEncoder.matches("SecurePass123!", savedUser.getPassword())).isTrue();
	}

	@Test
	void rejectsDuplicateEmailIgnoringLetterCase() throws Exception {
		register("case-sensitive@example.com", "SecurePass123!", "SecurePass123!")
				.andExpect(status().isCreated());

		register("CASE-SENSITIVE@example.com", "SecurePass123!", "SecurePass123!")
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("AUTH_EMAIL_ALREADY_REGISTERED"));
	}

	@Test
	void rejectsMismatchedPasswords() throws Exception {
		register("password-mismatch@example.com", "SecurePass123!", "DifferentPass123!")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.confirmPassword").value("Password confirmation must match password"));
	}

	@Test
	void rejectsInvalidEmail() throws Exception {
		register("not-an-email", "SecurePass123!", "SecurePass123!")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.email").value("Email must be valid"));
	}

	@Test
	void rejectsMalformedJson() throws Exception {
		mockMvc.perform(post("/api/v1/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"fullName\":\"Nguyen Van A\""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
	}

	@Test
	void rejectsPasswordExceedingBcryptUtf8ByteLimit() throws Exception {
		String tooLongUtf8Password = "é".repeat(37);

		register("unicode-password@example.com", tooLongUtf8Password, tooLongUtf8Password)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.fieldErrors.password").value("Password must not exceed 72 UTF-8 bytes"));
	}

	private ResultActions register(String email, String password, String confirmPassword) throws Exception {
		return mockMvc.perform(post("/api/v1/auth/register")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"fullName", "Nguyen Van A",
						"email", email,
						"password", password,
						"confirmPassword", confirmPassword
				))));
	}
}
