package com.techverse.server.service.impl;

import com.techverse.server.dto.request.UpdateMyProfileRequest;
import com.techverse.server.dto.response.MyProfileResponse;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.UserService;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

	private final UserRepository userRepository;

	@Override
	@Transactional(readOnly = true)
	public MyProfileResponse getMyProfile(UUID userId) {
		return toMyProfileResponse(findUserWithRoles(userId));
	}

	@Override
	@Transactional
	public MyProfileResponse updateMyProfile(UUID userId, UpdateMyProfileRequest request) {
		User user = findUserWithRoles(userId);
		user.updateProfile(request.fullName(), request.phoneNumber(), request.dateOfBirth());
		userRepository.saveAndFlush(user);
		return toMyProfileResponse(user);
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
				.createdAt(user.getCreatedAt())
				.updatedAt(user.getUpdatedAt())
				.build();
	}
}
