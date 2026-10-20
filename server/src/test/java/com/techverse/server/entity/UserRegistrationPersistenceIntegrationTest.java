package com.techverse.server.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.techverse.server.enums.RoleName;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserRegistrationPersistenceIntegrationTest {

	@Container
	@ServiceConnection
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(DockerImageName.parse("postgres:16-alpine"));

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private RoleRepository roleRepository;

	@Autowired
	private EntityManager entityManager;

	@Test
	void persistsLocalUserWithSeededLearnerRole() {
		roleRepository.findByName(RoleName.LEARNER).orElseThrow();
		User user = User.createLocalAccount("Nguyen Van A", "register-test@example.com", "encoded-password");

		User savedUser = userRepository.saveAndFlush(user);
		entityManager.clear();

		User reloadedUser = userRepository.findById(savedUser.getId()).orElseThrow();
		assertThat(reloadedUser.getId()).isNotNull();
		assertThat(reloadedUser.getFullName()).isEqualTo("Nguyen Van A");
		assertThat(reloadedUser.getEmail()).isEqualTo("register-test@example.com");
		assertThat(reloadedUser.getPassword()).isEqualTo("encoded-password");
		assertThat(reloadedUser.getCreatedAt()).isNotNull();
		assertThat(reloadedUser.getUpdatedAt()).isNotNull();
		assertThat(reloadedUser.getUserRoles())
				.extracting(userRole -> userRole.getRole().getName())
				.containsExactly(RoleName.LEARNER);
	}
}
