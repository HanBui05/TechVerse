package com.techverse.server.service.impl;

import com.techverse.server.dto.request.AdminAuthorApplicationFilter;
import com.techverse.server.dto.request.ReviewAuthorApplicationRequest;
import com.techverse.server.dto.request.SuspendAuthorRequest;
import com.techverse.server.dto.request.RestoreAuthorRequest;
import com.techverse.server.dto.response.AdminAuthorApplicationDetailResponse;
import com.techverse.server.dto.response.AdminAuthorApplicationSummaryResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.entity.AuthorProfile;
import com.techverse.server.entity.User;
import com.techverse.server.enums.AuthorProfileStatus;
import com.techverse.server.enums.AuthorReviewDecision;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.AuthorProfileRepository;
import com.techverse.server.repository.RoleRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.repository.specification.AuthorProfileSpecification;
import com.techverse.server.service.AdminAuthorApplicationService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminAuthorApplicationServiceImpl implements AdminAuthorApplicationService {
	private final AuthorProfileRepository profiles;
	private final UserRepository users;
	private final RoleRepository roles;

	@Override
	@Transactional(readOnly = true)
	public PageResponse<AdminAuthorApplicationSummaryResponse> getApplications(AdminAuthorApplicationFilter filter) {
		var specification = AuthorProfileSpecification.hasKeyword(filter.getKeyword())
				.and(AuthorProfileSpecification.hasStatus(filter.getStatus()))
				.and(AuthorProfileSpecification.hasActiveStatus(filter.getActive()));
		var sort = Sort.by(filter.getDirection(), filter.getSortBy().getProperty())
				.and(Sort.by(filter.getDirection(), "id"));
		var page = profiles.findAll(specification, PageRequest.of(filter.getPage(), filter.getSize(), sort));
		return PageResponse.from(page, page.getContent().stream().map(this::toSummary).toList());
	}

	@Override
	@Transactional(readOnly = true)
	public AdminAuthorApplicationDetailResponse getApplication(UUID id) {
		return toDetail(profiles.findDetailsById(id)
				.orElseThrow(() -> new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND)));
	}

	@Override
	@Transactional
	public AdminAuthorApplicationDetailResponse review(UUID actorId, UUID id, ReviewAuthorApplicationRequest request) {
		UUID applicantId = profiles.findApplicantIdById(id)
				.orElseThrow(() -> new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND));
		if (actorId.equals(applicantId)) {
			throw new CustomException(ErrorCode.AUTHOR_SELF_REVIEW_NOT_ALLOWED);
		}

		// Match account-status updates: lock user rows in database UUID order before the profile.
		var lockedUsers = users.findAllByIdForAdminStatusUpdate(List.of(actorId, applicantId)).stream()
				.collect(Collectors.toMap(User::getId, Function.identity()));
		User actor = lockedUsers.get(actorId);
		if (actor == null || !actor.isActive() || !hasRole(actor, RoleName.ADMIN)) {
			throw new CustomException(ErrorCode.ACCESS_DENIED);
		}
		User applicant = lockedUsers.get(applicantId);
		if (applicant == null) throw new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND);
		if (!applicant.isActive()) throw new CustomException(ErrorCode.USER_INACTIVE);

		AuthorProfile profile = profiles.findByIdForReview(id)
				.orElseThrow(() -> new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND));
		if (profile.getVersion() != request.expectedVersion()) {
			throw new CustomException(ErrorCode.AUTHOR_APPLICATION_STALE_VERSION);
		}
		if (profile.getStatus() != AuthorProfileStatus.PENDING) {
			throw new CustomException(ErrorCode.AUTHOR_APPLICATION_ALREADY_REVIEWED);
		}
		if (request.decision() == AuthorReviewDecision.APPROVED && !hasRole(applicant, RoleName.AUTHOR)) {
			applicant.addRole(roles.findByName(RoleName.AUTHOR)
					.orElseThrow(() -> new CustomException(ErrorCode.INTERNAL_ERROR)));
		}
		profile.review(AuthorProfileStatus.valueOf(request.decision().name()), actor, request.reviewNote(), Instant.now());
		profiles.flush();
		return toDetail(profile);
	}

	@Override
	@Transactional
	public AdminAuthorApplicationDetailResponse suspend(UUID actorId, UUID id, SuspendAuthorRequest request) {
		AuthorProfile profile = lockForStatusChange(actorId, id, request.expectedVersion());
		if (profile.getStatus() != AuthorProfileStatus.APPROVED) {
			throw new CustomException(ErrorCode.AUTHOR_NOT_APPROVED);
		}
		profile.suspend(users.getReferenceById(actorId), request.reason(), Instant.now());
		profiles.flush();
		return toDetail(profile);
	}

	@Override
	@Transactional
	public AdminAuthorApplicationDetailResponse restore(UUID actorId, UUID id, RestoreAuthorRequest request) {
		AuthorProfile profile = lockForStatusChange(actorId, id, request.expectedVersion());
		if (profile.getStatus() != AuthorProfileStatus.SUSPENDED) {
			throw new CustomException(ErrorCode.AUTHOR_NOT_SUSPENDED);
		}
		profile.restore(users.getReferenceById(actorId), request.note(), Instant.now());
		profiles.flush();
		return toDetail(profile);
	}

	private AuthorProfile lockForStatusChange(UUID actorId, UUID id, long expectedVersion) {
		UUID ownerId = profiles.findApplicantIdById(id)
				.orElseThrow(() -> new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND));
		if (actorId.equals(ownerId)) {
			throw new CustomException(ErrorCode.AUTHOR_SELF_STATUS_CHANGE_NOT_ALLOWED);
		}
		var lockedUsers = users.findAllByIdForAdminStatusUpdate(List.of(actorId, ownerId)).stream()
				.collect(Collectors.toMap(User::getId, Function.identity()));
		User actor = lockedUsers.get(actorId);
		if (actor == null || !actor.isActive() || !hasRole(actor, RoleName.ADMIN)) {
			throw new CustomException(ErrorCode.ACCESS_DENIED);
		}
		if (!lockedUsers.containsKey(ownerId)) {
			throw new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND);
		}
		// Account locking is independent: restoring AUTHOR must never unlock the user account.
		AuthorProfile profile = profiles.findByIdForReview(id)
				.orElseThrow(() -> new CustomException(ErrorCode.AUTHOR_APPLICATION_NOT_FOUND));
		if (profile.getVersion() != expectedVersion) {
			throw new CustomException(ErrorCode.AUTHOR_APPLICATION_STALE_VERSION);
		}
		return profile;
	}

	private boolean hasRole(User user, RoleName name) {
		return user.getUserRoles().stream().anyMatch(assignment -> assignment.getRole().getName() == name);
	}

	private AdminAuthorApplicationSummaryResponse toSummary(AuthorProfile profile) {
		User user = profile.getUser();
		return AdminAuthorApplicationSummaryResponse.builder()
				.id(profile.getId()).userId(user.getId()).fullName(user.getFullName()).email(user.getEmail())
				.active(user.isActive()).expertise(profile.getExpertise()).status(profile.getStatus())
				.version(profile.getVersion()).createdAt(profile.getCreatedAt()).updatedAt(profile.getUpdatedAt()).build();
	}

	private AdminAuthorApplicationDetailResponse toDetail(AuthorProfile profile) {
		User user = profile.getUser();
		User reviewer = profile.getReviewedBy();
		return AdminAuthorApplicationDetailResponse.builder()
				.id(profile.getId()).userId(user.getId()).fullName(user.getFullName()).email(user.getEmail())
				.active(user.isActive()).bio(profile.getBio()).expertise(profile.getExpertise())
				.portfolioUrl(profile.getPortfolioUrl()).status(profile.getStatus()).version(profile.getVersion())
				.reviewNote(profile.getReviewNote()).reviewedBy(reviewer == null ? null : reviewer.getId())
				.reviewerName(reviewer == null ? null : reviewer.getFullName()).reviewedAt(profile.getReviewedAt())
				.suspensionReason(profile.getSuspensionReason())
				.suspendedBy(profile.getSuspendedBy() == null ? null : profile.getSuspendedBy().getId())
				.suspendedAt(profile.getSuspendedAt()).restorationNote(profile.getRestorationNote())
				.restoredBy(profile.getRestoredBy() == null ? null : profile.getRestoredBy().getId())
				.restoredAt(profile.getRestoredAt())
				.createdAt(profile.getCreatedAt()).updatedAt(profile.getUpdatedAt()).build();
	}
}
