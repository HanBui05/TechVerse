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
import com.techverse.server.service.AuthorProfileService;
import com.techverse.server.service.TokenService;
import java.util.Set;
import java.time.Duration;
import java.time.Instant;
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
	private final AuthorProfileService authorProfileService;

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
		User user = userRepository.findByEmailForAuthentication(email)
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
				.findUserIdByProviderAndProviderId(validatedProfile.getProvider(), validatedProfile.getProviderId())
				.map(this::findSocialUserForAuthentication)
				.map(this::issueSocialRefreshTokenForActiveUser)
				.orElseGet(() -> createSocialAccountAndIssueRefreshToken(validatedProfile));
	}

	@Override
	@Transactional
	public LoginTokens refresh(String rawRefreshToken) {
		Jwt refreshToken = decodeRefreshToken(rawRefreshToken);
		UUID userId = parseUserId(refreshToken.getSubject());
		User user = userRepository.findByIdForAuthentication(userId)
				.filter(User::isActive)
				.orElseThrow(this::invalidRefreshToken);
		// Re-check Redis after acquiring the same lock used by logout/account locking.
		if (refreshToken.getExpiresAt() == null || !refreshToken.getExpiresAt().isAfter(Instant.now())
				|| !tokenService.isTokenActive(refreshToken, TokenType.REFRESH)) {
			throw invalidRefreshToken();
		}
		String sessionId = refreshToken.getClaimAsString("sid");
		JwtDetails accessToken = tokenService.generateAccessToken(userId, rolesOf(user), sessionId);
		if (!refreshToken.getExpiresAt().isAfter(Instant.now())) {
			throw invalidRefreshToken();
		}
		tokenService.saveToken(accessToken, userId, TokenType.ACCESS);
		return LoginTokens.builder()
				.accessToken(accessToken)
				.refreshToken(JwtDetails.builder()
						.value(rawRefreshToken)
						.jwtId(refreshToken.getId())
						.sessionId(sessionId)
						.expiresAt(refreshToken.getExpiresAt())
						.secondsTtl(Math.max(0, Duration.between(Instant.now(), refreshToken.getExpiresAt()).toSeconds()))
						.build())
				.build();
	}

	@Override
	@Transactional
	public void logout(UUID userId, String sessionId) {
		userRepository.findByIdForAuthentication(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
		tokenService.deleteSession(userId, sessionId);
	}

	@Override
	@Transactional
	public void logoutAll(UUID userId) {
		userRepository.findByIdForAuthentication(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.INVALID_ACCESS_TOKEN));
		tokenService.deleteAllTokensByUserId(userId);
	}

	private LoginTokens issueLoginTokens(User user) {
		String sessionId = UUID.randomUUID().toString();
		Set<RoleName> roles = rolesOf(user);
		JwtDetails accessToken = tokenService.generateAccessToken(user.getId(), roles, sessionId);
		JwtDetails refreshToken = tokenService.generateRefreshToken(user.getId(), roles, sessionId);
		tokenService.createSession(user.getId(), refreshToken);
		tokenService.saveToken(accessToken, user.getId(), TokenType.ACCESS);
		tokenService.saveToken(refreshToken, user.getId(), TokenType.REFRESH);

		return LoginTokens.builder()
				.accessToken(accessToken)
				.refreshToken(refreshToken)
				.build();
	}

	private Set<RoleName> rolesOf(User user) {
		return user.getUserRoles().stream()
				.map(userRole -> userRole.getRole().getName())
				.filter(role -> role != RoleName.AUTHOR || authorProfileService.isApprovedAuthor(user.getId()))
				.collect(Collectors.toUnmodifiableSet());
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

		JwtDetails refreshToken = tokenService.generateRefreshToken(user.getId(), Set.of(), UUID.randomUUID().toString());
		tokenService.createSession(user.getId(), refreshToken);
		tokenService.saveToken(refreshToken, user.getId(), TokenType.REFRESH);
		return refreshToken;
	}

	private User findSocialUserForAuthentication(UUID userId) {
		return userRepository.findByIdForAuthentication(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.SOCIAL_ACCOUNT_INACTIVE));
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

	private UUID parseUserId(String userId) {
		try {
			return UUID.fromString(userId);
		} catch (IllegalArgumentException | NullPointerException exception) {
			throw invalidRefreshToken();
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
