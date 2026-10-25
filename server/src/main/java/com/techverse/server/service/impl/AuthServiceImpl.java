package com.techverse.server.service.impl;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.dto.internal.LoginTokens;
import com.techverse.server.dto.internal.SocialProfile;
import com.techverse.server.dto.request.LoginRequest;
import com.techverse.server.dto.request.RegisterRequest;
import com.techverse.server.dto.response.RegisterResponse;
import com.techverse.server.entity.SocialAccount;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import com.techverse.server.event.UserRegisteredEvent;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.SocialAccountRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthService;
import com.techverse.server.service.TokenService;
import java.util.Set;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

	private final UserRepository userRepository;
	private final SocialAccountRepository socialAccountRepository;
	private final RoleRepository roleRepository;
	private final PasswordEncoder passwordEncoder;
	private final ApplicationEventPublisher eventPublisher;
	private final TokenService tokenService;

	@Override
	@Transactional
	public RegisterResponse register(RegisterRequest request) {
		String email = request.email().trim();
		if (userRepository.existsByEmailIgnoreCase(email)) {
			throw new CustomException(ErrorCode.EMAIL_ALREADY_REGISTERED);
		}

		roleRepository.findByName(RoleName.LEARNER)
				.orElseThrow(() -> new CustomException(ErrorCode.DEFAULT_ROLE_NOT_FOUND));

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
				.orElseThrow(() -> new CustomException(ErrorCode.INVALID_CREDENTIALS));

		if (!user.isActive()
				|| user.getPassword() == null
				|| !passwordEncoder.matches(request.password(), user.getPassword())) {
			throw new CustomException(ErrorCode.INVALID_CREDENTIALS);
		}

		return issueLoginTokens(user);
	}

	@Override
	@Transactional
	public JwtDetails authenticateSocialAccount(SocialProfile profile) {
		SocialProfile validatedProfile = validateSocialProfile(profile);
		return socialAccountRepository
				.findByProviderAndProviderId(validatedProfile.getProvider(), validatedProfile.getProviderId())
				.map(SocialAccount::getUser)
				.map(this::issueSocialRefreshTokenForActiveUser)
				.orElseGet(() -> createSocialAccountAndIssueRefreshToken(validatedProfile));
	}

	@Override
	@Transactional
	public LoginTokens refresh(String rawRefreshToken) {
		Jwt refreshToken = decodeRefreshToken(rawRefreshToken);
		UUID userId = parseUserId(refreshToken.getSubject());
		String refreshTokenId = refreshToken.getId();
		if (refreshTokenId == null
				|| tokenService.findUserId(refreshTokenId, TokenType.REFRESH)
				.filter(userId::equals)
				.isEmpty()) {
			throw invalidRefreshToken();
		}

		User user = userRepository.findById(userId)
				.filter(User::isActive)
				.orElseThrow(this::invalidRefreshToken);
		tokenService.deleteToken(refreshTokenId);
		return issueLoginTokens(user);
	}

	@Override
	public void logout(String rawAccessToken, String rawRefreshToken) {
		revokeToken(rawAccessToken, TokenType.ACCESS);
		revokeToken(rawRefreshToken, TokenType.REFRESH);
	}

	@Override
	public void logoutAll(UUID userId) {
		tokenService.deleteAllTokensByUserId(userId);
	}

	private LoginTokens issueLoginTokens(User user) {
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

	private JwtDetails createSocialAccountAndIssueRefreshToken(SocialProfile profile) {
		if (userRepository.existsByEmailIgnoreCase(profile.getEmail())) {
			throw new CustomException(ErrorCode.SOCIAL_EMAIL_ALREADY_REGISTERED);
		}

		roleRepository.findByName(RoleName.LEARNER)
				.orElseThrow(() -> new CustomException(ErrorCode.DEFAULT_ROLE_NOT_FOUND));

		User savedUser = userRepository.saveAndFlush(User.createSocialAccount(
				profile.getFullName(),
				profile.getEmail()
		));
		socialAccountRepository.save(SocialAccount.link(
				savedUser,
				profile.getProvider(),
				profile.getProviderId()
		));
		eventPublisher.publishEvent(new UserRegisteredEvent(savedUser.getFullName(), savedUser.getEmail()));

		return issueSocialRefreshTokenForActiveUser(savedUser);
	}

	private JwtDetails issueSocialRefreshTokenForActiveUser(User user) {
		if (!user.isActive()) {
			throw new CustomException(ErrorCode.SOCIAL_ACCOUNT_INACTIVE);
		}

		JwtDetails refreshToken = tokenService.generateRefreshToken(user.getId(), Set.of());
		tokenService.saveToken(refreshToken, user.getId(), TokenType.REFRESH);
		return refreshToken;
	}

	private SocialProfile validateSocialProfile(SocialProfile profile) {
		if (profile == null
				|| profile.getProvider() == null
				|| !profile.isEmailVerified()
				|| isBlank(profile.getProviderId())
				|| isBlank(profile.getEmail())
				|| isBlank(profile.getFullName())) {
			throw new CustomException(ErrorCode.SOCIAL_PROFILE_INVALID);
		}

		return SocialProfile.builder()
				.provider(profile.getProvider())
				.providerId(profile.getProviderId().trim())
				.email(profile.getEmail().trim())
				.fullName(profile.getFullName().trim())
				.emailVerified(true)
				.build();
	}

	private Jwt decodeRefreshToken(String rawRefreshToken) {
		if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
			throw invalidRefreshToken();
		}
		try {
			return tokenService.decodeRefreshToken(rawRefreshToken);
		} catch (JwtException exception) {
			throw invalidRefreshToken();
		}
	}

	private void revokeToken(String rawToken, TokenType tokenType) {
		if (rawToken == null || rawToken.isBlank()) {
			return;
		}
		try {
			Jwt token = tokenService.decodeTokenForLogout(rawToken);
			Optional<UUID> userId = tryParseUserId(token.getSubject());
			if (token.getId() != null
					&& tokenType.name().toLowerCase(Locale.ROOT).equals(token.getClaimAsString("token_type"))
					&& userId.filter(id -> tokenService.findUserId(token.getId(), tokenType)
							.filter(id::equals)
							.isPresent()).isPresent()) {
				tokenService.deleteToken(token.getId());
			}
		} catch (JwtException exception) {
			// Logout is idempotent: an invalid or expired browser token is already unusable.
		}
	}

	private UUID parseUserId(String userId) {
		try {
			return UUID.fromString(userId);
		} catch (IllegalArgumentException exception) {
			throw invalidRefreshToken();
		}
	}

	private Optional<UUID> tryParseUserId(String userId) {
		try {
			return Optional.of(UUID.fromString(userId));
		} catch (IllegalArgumentException exception) {
			return Optional.empty();
		}
	}

	private CustomException invalidRefreshToken() {
		return new CustomException(ErrorCode.INVALID_REFRESH_TOKEN);
	}

	private String normalizeOptional(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	private boolean isBlank(String value) {
		return value == null || value.isBlank();
	}
}
