package com.techverse.server.service.impl;

import com.techverse.server.dto.request.ApplyAuthorProfileRequest;
import com.techverse.server.dto.request.ResubmitAuthorProfileRequest;
import com.techverse.server.enums.AuthorProfileStatus;
import com.techverse.server.dto.response.AuthorProfileResponse;
import com.techverse.server.dto.response.MyAuthorProfileResponse;
import com.techverse.server.entity.AuthorProfile;
import com.techverse.server.entity.User;
import com.techverse.server.enums.AuthorApplicationStatus;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.AuthorProfileRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.AuthorProfileService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthorProfileServiceImpl implements AuthorProfileService {

	private final AuthorProfileRepository authorProfileRepository;
	private final UserRepository userRepository;

	@Override
	@Transactional
	public AuthorProfileResponse apply(UUID userId, ApplyAuthorProfileRequest request) {
		User user = userRepository.findByIdForAuthorProfileApplication(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
		if (!user.isActive()) {
			throw new CustomException(ErrorCode.USER_INACTIVE);
		}
		if (authorProfileRepository.existsByUser_Id(userId)) {
			throw new CustomException(ErrorCode.AUTHOR_PROFILE_ALREADY_EXISTS);
		}

		AuthorProfile authorProfile = authorProfileRepository.saveAndFlush(AuthorProfile.create(
				user,
				request.bio(),
				request.expertise(),
				request.portfolioUrl()
		));
		return toResponse(authorProfile);
	}

	@Override
	@Transactional(readOnly = true)
	public MyAuthorProfileResponse getMyProfile(UUID userId) {
		User user = userRepository.findById(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
		if (!user.isActive()) {
			throw new CustomException(ErrorCode.USER_INACTIVE);
		}

		return authorProfileRepository.findByUser_Id(userId)
				.map(authorProfile -> MyAuthorProfileResponse.builder()
						.applicationStatus(AuthorApplicationStatus.valueOf(authorProfile.getStatus().name()))
						.profile(toResponse(authorProfile))
						.build())
				.orElseGet(() -> MyAuthorProfileResponse.builder()
						.applicationStatus(AuthorApplicationStatus.NOT_APPLIED)
						.profile(null)
						.build());
	}

	@Override
	@Transactional
	public AuthorProfileResponse resubmit(UUID userId, ResubmitAuthorProfileRequest request) {
		User user = userRepository.findByIdForAuthorProfileApplication(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
		if (!user.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);
		AuthorProfile profile = authorProfileRepository.findByUserIdForResubmit(userId)
				.orElseThrow(() -> new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND));
		if (profile.getVersion() != request.expectedVersion()) {
			throw new CustomException(ErrorCode.AUTHOR_APPLICATION_STALE_VERSION);
		}
		if (profile.getStatus() != AuthorProfileStatus.REJECTED) {
			throw new CustomException(ErrorCode.AUTHOR_APPLICATION_RESUBMIT_NOT_ALLOWED);
		}
		profile.resubmit(request.bio(), request.expertise(), request.portfolioUrl());
		authorProfileRepository.flush();
		return toResponse(profile);
	}

	@Override
	@Transactional(readOnly = true)
	public boolean isApprovedAuthor(UUID userId) {
		return authorProfileRepository.hasActiveAuthorPermission(userId, AuthorProfileStatus.APPROVED, RoleName.AUTHOR);
	}

	private AuthorProfileResponse toResponse(AuthorProfile authorProfile) {
		return AuthorProfileResponse.builder()
				.id(authorProfile.getId())
				.bio(authorProfile.getBio())
				.expertise(authorProfile.getExpertise())
				.portfolioUrl(authorProfile.getPortfolioUrl())
				.status(authorProfile.getStatus())
				.version(authorProfile.getVersion())
				.reviewNote(authorProfile.getReviewNote())
				.reviewedAt(authorProfile.getReviewedAt())
				.suspensionReason(authorProfile.getSuspensionReason())
				.suspendedAt(authorProfile.getSuspendedAt())
				.restorationNote(authorProfile.getRestorationNote())
				.restoredAt(authorProfile.getRestoredAt())
				.createdAt(authorProfile.getCreatedAt())
				.updatedAt(authorProfile.getUpdatedAt())
				.build();
	}
}
