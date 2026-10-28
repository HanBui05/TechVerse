package com.techverse.server.service.impl;

import com.techverse.server.dto.request.AdminUserFilter;
import com.techverse.server.dto.request.AdminUserStatusUpdateRequest;
import com.techverse.server.dto.response.AdminAuthorProfileResponse;
import com.techverse.server.dto.response.AdminUserDetailResponse;
import com.techverse.server.dto.response.AdminUserSummaryResponse;
import com.techverse.server.dto.response.AdminUserStatusUpdateResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.entity.AuthorProfile;
import com.techverse.server.entity.SocialAccount;
import com.techverse.server.entity.User;
import com.techverse.server.enums.AuthorProfileStatus;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.SocialProvider;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.AuthorProfileRepository;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.SocialAccountRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.repository.UserRoleRepository;
import com.techverse.server.repository.specification.UserSpecification;
import com.techverse.server.service.AdminUserService;
import com.techverse.server.service.TokenService;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {

	private final UserRepository userRepository;
	private final UserRoleRepository userRoleRepository;
	private final AuthorProfileRepository authorProfileRepository;
	private final SocialAccountRepository socialAccountRepository;
	private final RoleRepository roleRepository;
	private final TokenService tokenService;

	@Override
	@Transactional(readOnly = true)
	public PageResponse<AdminUserSummaryResponse> getUsers(AdminUserFilter filter) {
		Specification<User> specification = UserSpecification.hasKeyword(filter.getKeyword())
				.and(UserSpecification.hasActiveStatus(filter.getActive()))
				.and(UserSpecification.hasRole(filter.getRole()))
				.and(UserSpecification.hasAuthorProfileStatus(filter.getAuthorStatus()));
		Sort sort = Sort.by(filter.getDirection(), filter.getSortBy().getProperty())
				.and(Sort.by(filter.getDirection(), "id"));
		Page<User> userPage = userRepository.findAll(
				specification,
				PageRequest.of(filter.getPage(), filter.getSize(), sort)
		);

		List<UUID> userIds = userPage.getContent().stream().map(User::getId).toList();
		Map<UUID, List<RoleName>> rolesByUserId = findRolesByUserId(userIds);
		Map<UUID, AuthorProfileStatus> authorStatusesByUserId = findAuthorStatusesByUserId(userIds);
		List<AdminUserSummaryResponse> content = userPage.getContent().stream()
				.map(user -> toSummaryResponse(
						user,
						rolesByUserId.getOrDefault(user.getId(), List.of()),
						authorStatusesByUserId.get(user.getId())
				))
				.toList();

		return PageResponse.from(userPage, content);
	}

	@Override
	@Transactional(readOnly = true)
	public AdminUserDetailResponse getUserDetails(UUID userId) {
		User user = userRepository.findWithRolesById(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

		List<RoleName> roles = user.getUserRoles().stream()
				.map(userRole -> userRole.getRole().getName())
				.sorted()
				.toList();
		List<SocialProvider> socialProviders = socialAccountRepository.findByUser_Id(userId).stream()
				.map(SocialAccount::getProvider)
				.distinct()
				.sorted(Comparator.naturalOrder())
				.toList();
		AdminAuthorProfileResponse authorProfile = authorProfileRepository.findByUser_Id(userId)
				.map(this::toAuthorProfileResponse)
				.orElse(null);

		return AdminUserDetailResponse.builder()
				.id(user.getId())
				.fullName(user.getFullName())
				.email(user.getEmail())
				.phoneNumber(user.getPhoneNumber())
				.dateOfBirth(user.getDateOfBirth())
				.avatarUrl(user.getAvatarUrl())
				.active(user.isActive())
				.roles(roles)
				.hasLocalPassword(user.getPassword() != null && !user.getPassword().isBlank())
				.socialProviders(socialProviders)
				.authorProfile(authorProfile)
				.createdAt(user.getCreatedAt())
				.updatedAt(user.getUpdatedAt())
				.build();
	}

	@Override
	@Transactional
	public AdminUserStatusUpdateResponse updateUserStatuses(UUID actorId, AdminUserStatusUpdateRequest request) {
		List<UUID> userIds = request.userIds();
		if (new HashSet<>(userIds).size() != userIds.size()) {
			throw new CustomException(ErrorCode.INVALID_USER_SELECTION);
		}

		roleRepository.findByNameForUpdate(RoleName.ADMIN)
				.orElseThrow(() -> new CustomException(ErrorCode.INTERNAL_ERROR));

		List<User> selectedUsers = userRepository.findAllByIdForAdminStatusUpdate(userIds);
		if (selectedUsers.size() != userIds.size()) {
			throw new CustomException(ErrorCode.USER_NOT_FOUND);
		}
		Map<UUID, User> usersById = selectedUsers.stream()
				.collect(Collectors.toMap(User::getId, Function.identity()));

		boolean targetActive = request.active();
		if (!targetActive) {
			if (userIds.contains(actorId)) {
				throw new CustomException(ErrorCode.ADMIN_SELF_LOCK_NOT_ALLOWED);
			}

			long activeAdminCount = userRoleRepository.countActiveUsersByRole(RoleName.ADMIN);
			long selectedActiveAdminCount = userRoleRepository.countActiveUsersByRoleAndUserIdIn(
					RoleName.ADMIN,
					userIds
			);
			if (activeAdminCount - selectedActiveAdminCount <= 0) {
				throw new CustomException(ErrorCode.LAST_ACTIVE_ADMIN_CANNOT_BE_LOCKED);
			}
		}

		int changedCount = 0;
		for (UUID userId : userIds) {
			User user = usersById.get(userId);
			if (user.isActive() == targetActive) {
				continue;
			}

			user.updateActiveStatus(targetActive);
			changedCount++;
			if (!targetActive) {
				tokenService.deleteAllTokensByUserId(userId);
			}
		}

		List<AdminUserStatusUpdateResponse.UserStatus> finalStatuses = userIds.stream()
				.map(userId -> AdminUserStatusUpdateResponse.UserStatus.builder()
						.userId(userId)
						.active(usersById.get(userId).isActive())
						.build())
				.toList();
		return AdminUserStatusUpdateResponse.builder()
				.active(targetActive)
				.requestedCount(userIds.size())
				.changedCount(changedCount)
				.unchangedCount(userIds.size() - changedCount)
				.users(finalStatuses)
				.build();
	}

	private Map<UUID, List<RoleName>> findRolesByUserId(Collection<UUID> userIds) {
		if (userIds.isEmpty()) {
			return Map.of();
		}

		return userRoleRepository.findWithRoleByUserIdIn(userIds).stream()
				.collect(Collectors.groupingBy(
						userRole -> userRole.getUser().getId(),
						Collectors.mapping(
								userRole -> userRole.getRole().getName(),
								Collectors.collectingAndThen(
										Collectors.toList(),
										roles -> roles.stream().distinct().sorted().toList()
								)
						)
				));
	}

	private Map<UUID, AuthorProfileStatus> findAuthorStatusesByUserId(Collection<UUID> userIds) {
		if (userIds.isEmpty()) {
			return Map.of();
		}

		return authorProfileRepository.findByUser_IdIn(userIds).stream()
				.collect(Collectors.toMap(
						authorProfile -> authorProfile.getUser().getId(),
						AuthorProfile::getStatus
				));
	}

	private AdminUserSummaryResponse toSummaryResponse(
			User user,
			List<RoleName> roles,
			AuthorProfileStatus authorProfileStatus
	) {
		return AdminUserSummaryResponse.builder()
				.id(user.getId())
				.fullName(user.getFullName())
				.email(user.getEmail())
				.roles(roles)
				.active(user.isActive())
				.authorProfileStatus(authorProfileStatus)
				.createdAt(user.getCreatedAt())
				.build();
	}

	private AdminAuthorProfileResponse toAuthorProfileResponse(AuthorProfile authorProfile) {
		return AdminAuthorProfileResponse.builder()
				.id(authorProfile.getId())
				.bio(authorProfile.getBio())
				.expertise(authorProfile.getExpertise())
				.portfolioUrl(authorProfile.getPortfolioUrl())
				.status(authorProfile.getStatus())
				.reviewNote(authorProfile.getReviewNote())
				.reviewedAt(authorProfile.getReviewedAt())
				.createdAt(authorProfile.getCreatedAt())
				.updatedAt(authorProfile.getUpdatedAt())
				.build();
	}
}
