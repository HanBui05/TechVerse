package com.techverse.server.service.impl;

import com.techverse.server.dto.request.RegisterRequest;
import com.techverse.server.dto.response.RegisterResponse;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.BusinessException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthService;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

	private final UserRepository userRepository;
	private final RoleRepository roleRepository;
	private final PasswordEncoder passwordEncoder;

	@Override
	@Transactional
	public RegisterResponse register(RegisterRequest request) {
		String email = request.email().trim();
		if (userRepository.existsByEmailIgnoreCase(email)) {
			throw new BusinessException(ErrorCode.EMAIL_ALREADY_REGISTERED);
		}

		roleRepository.findByName(RoleName.LEARNER)
				.orElseThrow(() -> new BusinessException(ErrorCode.DEFAULT_ROLE_NOT_FOUND));

		User user = User.createLocalAccount(
				request.fullName().trim(),
				email,
				passwordEncoder.encode(request.password())
		);
		User savedUser = userRepository.saveAndFlush(user);

		return new RegisterResponse(
				savedUser.getId(),
				savedUser.getFullName(),
				savedUser.getEmail(),
				Set.of(RoleName.LEARNER)
		);
	}
}
