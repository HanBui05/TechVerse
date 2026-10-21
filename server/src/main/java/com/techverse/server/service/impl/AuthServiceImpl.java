package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.dto.internal.LoginTokens;
import com.techverse.server.dto.request.LoginRequest;
import com.techverse.server.dto.request.RegisterRequest;
import com.techverse.server.dto.response.RegisterResponse;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import com.techverse.server.event.UserRegisteredEvent;
import com.techverse.server.exception.BusinessException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthService;
import com.techverse.server.service.TokenService;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

	private final UserRepository userRepository;
	private final RoleRepository roleRepository;
	private final PasswordEncoder passwordEncoder;
	private final ApplicationEventPublisher eventPublisher;
	private final TokenService tokenService;

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
				passwordEncoder.encode(request.password()),
				normalizeOptional(request.phoneNumber()),
				request.dateOfBirth()
		);
		User savedUser = userRepository.saveAndFlush(user);
		eventPublisher.publishEvent(new UserRegisteredEvent(savedUser.getFullName(), savedUser.getEmail()));

		return RegisterResponse.builder()
				.id(savedUser.getId())
				.fullName(savedUser.getFullName())
				.email(savedUser.getEmail())
				.phoneNumber(savedUser.getPhoneNumber())
				.dateOfBirth(savedUser.getDateOfBirth())
				.roles(Set.of(RoleName.LEARNER))
				.build();
	}

	@Override
	@Transactional
	public LoginTokens login(LoginRequest request) {
		String email = request.email().trim();
		User user = userRepository.findByEmail(email)
				.orElseThrow(() -> new BusinessException(ErrorCode.INVALID_CREDENTIALS));

		if (!user.isActive()
				|| user.getPassword() == null
				|| !passwordEncoder.matches(request.password(), user.getPassword())) {
			throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
		}

		Set<RoleName> roles = user.getUserRoles().stream()
				.map(userRole -> userRole.getRole().getName())
				.collect(Collectors.toUnmodifiableSet());
		JwtDetails accessToken = tokenService.generateAccessToken(user.getId(), roles);
		JwtDetails refreshToken = tokenService.generateRefreshToken(user.getId(), roles);
		tokenService.saveToken(accessToken, user.getId(), TokenType.ACCESS);
		tokenService.saveToken(refreshToken, user.getId(), TokenType.REFRESH);

		return LoginTokens.builder()
				.accessToken(accessToken)
				.refreshToken(refreshToken)
				.build();
	}

	private String normalizeOptional(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
