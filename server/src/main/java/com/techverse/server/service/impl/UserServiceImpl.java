package com.techverse.server.service.impl;

import com.techverse.server.dto.request.ChangeMyPasswordRequest;
import com.techverse.server.dto.request.UpdateMyProfileRequest;
import com.techverse.server.dto.response.MyProfileResponse;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.PasswordChangeAttemptRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.TokenService;
import com.techverse.server.service.UserService;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;
	private final PasswordChangeAttemptRepository passwordChangeAttempts;
	private final TokenService tokenService;

	@Override
	@Transactional(readOnly = true)
	public MyProfileResponse getMyProfile(UUID userId) {
		return toMyProfileResponse(findUserWithRoles(userId));
	}

	@Override
	@Transactional
	public MyProfileResponse updateMyProfile(UUID userId, UpdateMyProfileRequest request) {
		User user = findUserWithRoles(userId);
		if (request.hasFullName()) {
			user.changeFullName(request.getFullName());
		}
		if (request.hasPhoneNumber()) {
			user.changePhoneNumber(request.getPhoneNumber());
		}
		if (request.hasDateOfBirth()) {
			user.changeDateOfBirth(request.getDateOfBirth());
		}
		userRepository.saveAndFlush(user);
		return toMyProfileResponse(user);
	}

	@Override
	@Transactional
	public void changeMyPassword(UUID userId, String currentSessionId, ChangeMyPasswordRequest request) {
		// Same row lock as login, refresh, logout and password reset.
		User user = userRepository.findByIdForAuthentication(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
		if (!user.hasLocalPassword()) {
			throw new CustomException(ErrorCode.PASSWORD_CHANGE_UNAVAILABLE);
		}
		if (passwordChangeAttempts.isBlocked(userId)) {
			throw new CustomException(ErrorCode.PASSWORD_CHANGE_RATE_LIMITED);
		}
		if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
			passwordChangeAttempts.recordFailure(userId);
			throw new CustomException(ErrorCode.CURRENT_PASSWORD_INCORRECT);
		}
		if (passwordEncoder.matches(request.newPassword(), user.getPassword())) {
			throw new CustomException(ErrorCode.NEW_PASSWORD_MUST_DIFFER);
		}
		user.changePassword(passwordEncoder.encode(request.newPassword()));
		userRepository.saveAndFlush(user);
		passwordChangeAttempts.reset(userId);
		tokenService.deleteOtherSessions(userId, currentSessionId);
	}

	private User findUserWithRoles(UUID userId) {
		return userRepository.findWithRolesById(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
	}

	private MyProfileResponse toMyProfileResponse(User user) {
		Set<RoleName> roles = user.getUserRoles().stream()
				.map(userRole -> userRole.getRole().getName())
				.collect(Collectors.toUnmodifiableSet());

		return MyProfileResponse.builder()
				.id(user.getId())
				.fullName(user.getFullName())
				.email(user.getEmail())
				.phoneNumber(user.getPhoneNumber())
				.dateOfBirth(user.getDateOfBirth())
				.avatarUrl(user.getAvatarUrl())
				.roles(roles)
				.hasLocalPassword(user.hasLocalPassword())
				.createdAt(user.getCreatedAt())
				.updatedAt(user.getUpdatedAt())
				.build();
	}
}
