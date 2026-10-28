package com.techverse.server.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.techverse.server.entity.Role;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

class InitialAdminInitializerTest {

	private final UserRepository userRepository = mock(UserRepository.class);
	private final RoleRepository roleRepository = mock(RoleRepository.class);
	private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
	private final ApplicationArguments applicationArguments = mock(ApplicationArguments.class);

	@Test
	void doesNothingWhenAdminCredentialsAreNotConfigured() throws Exception {
		InitialAdminInitializer initializer = initializer(" ", "");

		initializer.run(applicationArguments);

		verifyNoInteractions(userRepository, roleRepository, passwordEncoder);
	}

	@Test
	void createsAdminWithEncodedPasswordAndAdminRoleWhenEmailIsUnused() throws Exception {
		Role adminRole = mock(Role.class);
		when(adminRole.getName()).thenReturn(RoleName.ADMIN);
		when(userRepository.existsByEmailIgnoreCase("admin@example.com")).thenReturn(false);
		when(roleRepository.findByName(RoleName.ADMIN)).thenReturn(Optional.of(adminRole));
		when(passwordEncoder.encode("SecureAdminPass123!")).thenReturn("{bcrypt}encoded-password");

		initializer(" Admin@Example.com ", "SecureAdminPass123!").run(applicationArguments);

		var savedUser = org.mockito.ArgumentCaptor.forClass(User.class);
		verify(userRepository).save(savedUser.capture());
		assertThat(savedUser.getValue().getFullName()).isEqualTo("TechVerse Admin");
		assertThat(savedUser.getValue().getEmail()).isEqualTo("admin@example.com");
		assertThat(savedUser.getValue().getPassword()).isEqualTo("{bcrypt}encoded-password");
		assertThat(savedUser.getValue().isActive()).isTrue();
		assertThat(savedUser.getValue().getUserRoles())
				.extracting(userRole -> userRole.getRole().getName())
				.containsExactly(RoleName.ADMIN);
		verify(passwordEncoder).encode("SecureAdminPass123!");
	}

	@Test
	void doesNotChangeOrPromoteAnExistingAccount() throws Exception {
		when(userRepository.existsByEmailIgnoreCase("admin@example.com")).thenReturn(true);

		initializer("admin@example.com", "NewAdminPass123!").run(applicationArguments);

		verify(userRepository).existsByEmailIgnoreCase("admin@example.com");
		verifyNoInteractions(roleRepository, passwordEncoder);
	}

	private InitialAdminInitializer initializer(String email, String password) {
		return new InitialAdminInitializer(userRepository, roleRepository, passwordEncoder, email, password);
	}
}
