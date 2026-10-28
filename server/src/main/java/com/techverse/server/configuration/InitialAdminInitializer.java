package com.techverse.server.configuration;

import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.UserRepository;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@Profile("dev")
public class InitialAdminInitializer implements ApplicationRunner {

	private static final String INITIAL_ADMIN_FULL_NAME = "TechVerse Admin";

	private final UserRepository userRepository;
	private final RoleRepository roleRepository;
	private final PasswordEncoder passwordEncoder;
	private final String adminEmail;
	private final String adminPassword;

	public InitialAdminInitializer(
			UserRepository userRepository,
			RoleRepository roleRepository,
			PasswordEncoder passwordEncoder,
			@Value("${initial-admin.email:}") String adminEmail,
			@Value("${initial-admin.password:}") String adminPassword
	) {
		this.userRepository = userRepository;
		this.roleRepository = roleRepository;
		this.passwordEncoder = passwordEncoder;
		this.adminEmail = adminEmail;
		this.adminPassword = adminPassword;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		String normalizedEmail = normalizeEmail(adminEmail);
		if (normalizedEmail.isBlank() || adminPassword == null || adminPassword.isBlank()) {
			log.warn("Initial admin bootstrap skipped; configure INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD for the dev profile");
			return;
		}

		if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
			log.info("Initial admin bootstrap skipped because an account with email {} already exists", normalizedEmail);
			return;
		}

		var adminRole = roleRepository.findByName(RoleName.ADMIN)
				.orElseThrow(() -> new IllegalStateException("The ADMIN role must exist before the initial admin can be created"));

		User admin = User.createLocalAccount(
				INITIAL_ADMIN_FULL_NAME,
				normalizedEmail,
				passwordEncoder.encode(adminPassword)
		);
		admin.addRole(adminRole);
		userRepository.save(admin);

		log.info("Initial admin account {} was created", normalizedEmail);
	}

	private String normalizeEmail(String email) {
		return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
	}
}
