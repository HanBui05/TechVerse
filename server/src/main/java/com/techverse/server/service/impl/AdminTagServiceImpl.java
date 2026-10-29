package com.techverse.server.service.impl;

import com.techverse.server.dto.request.AdminTagFilter;
import com.techverse.server.dto.request.CreateTagRequest;
import com.techverse.server.dto.request.UpdateTagRequest;
import com.techverse.server.dto.request.UpdateTagStatusRequest;
import com.techverse.server.dto.response.AdminTagResponse;
import com.techverse.server.dto.response.AdminTagSummaryResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.entity.Tag;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.TagRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.repository.specification.TagSpecification;
import com.techverse.server.service.AdminTagService;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminTagServiceImpl implements AdminTagService {
	private final TagRepository tags;
	private final UserRepository users;
	private final EntityManager entityManager;

	@Override
	@Transactional
	public AdminTagResponse create(UUID actorId, CreateTagRequest request) {
		lockActiveAdmin(actorId);
		if (tags.existsByNameIgnoreCase(request.name())) {
			throw new CustomException(ErrorCode.TAG_EXISTED);
		}
		Tag tag = Tag.builder().name(request.name()).description(request.description()).build();
		try {
			tags.saveAndFlush(tag);
			entityManager.refresh(tag);
		} catch (DataIntegrityViolationException exception) {
			throw translateNameConflict(exception);
		}
		return toResponse(tag);
	}

	@Override
	@Transactional(readOnly = true)
	public PageResponse<AdminTagSummaryResponse> getTags(AdminTagFilter filter) {
		var specification = TagSpecification.hasKeyword(filter.getKeyword())
				.and(TagSpecification.hasActiveStatus(filter.getActive()));
		Sort sort = Sort.by(filter.getDirection(), filter.getSortBy().getProperty())
				.and(Sort.by(filter.getDirection(), "id"));
		var page = tags.findAll(specification, PageRequest.of(filter.getPage(), filter.getSize(), sort));
		return PageResponse.from(page, page.getContent().stream().map(tag -> AdminTagSummaryResponse.builder()
				.id(tag.getId()).name(tag.getName()).description(tag.getDescription()).active(tag.isActive())
				.createdAt(tag.getCreatedAt()).updatedAt(tag.getUpdatedAt()).build()).toList());
	}

	@Override
	@Transactional(readOnly = true)
	public AdminTagResponse getTag(UUID id) {
		return toResponse(tags.findById(id).orElseThrow(() -> new CustomException(ErrorCode.TAG_NOT_FOUND)));
	}

	@Override
	@Transactional
	public AdminTagResponse update(UUID actorId, UUID id, UpdateTagRequest request) {
		lockActiveAdmin(actorId);
		Tag tag = lockTag(id);
		if (request.isNameProvided()) {
			if (tags.existsByNameIgnoreCaseAndIdNot(request.getName(), id)) {
				throw new CustomException(ErrorCode.TAG_EXISTED);
			}
			tag.updateName(request.getName());
		}
		if (request.isDescriptionProvided()) tag.updateDescription(request.getDescription());
		flushTag(tag);
		return toResponse(tag);
	}

	@Override
	@Transactional
	public AdminTagResponse updateStatus(UUID actorId, UUID id, UpdateTagStatusRequest request) {
		lockActiveAdmin(actorId);
		Tag tag = lockTag(id);
		// No linked content changes: inactive retires the tag from future assignments only.
		if (tag.isActive() != request.active()) {
			tag.updateActiveStatus(request.active());
			flushTag(tag);
		}
		return toResponse(tag);
	}

	private void lockActiveAdmin(UUID actorId) {
		// User first, tag second, consistent with account locking and other admin writes.
		User actor = users.findByIdForAuthentication(actorId)
				.orElseThrow(() -> new CustomException(ErrorCode.ACCESS_DENIED));
		if (!actor.isActive() || actor.getUserRoles().stream()
				.noneMatch(assignment -> assignment.getRole().getName() == RoleName.ADMIN)) {
			throw new CustomException(ErrorCode.ACCESS_DENIED);
		}
	}

	private Tag lockTag(UUID id) {
		return tags.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.TAG_NOT_FOUND));
	}

	private void flushTag(Tag tag) {
		try {
			tags.flush();
			// Reload database-trigger timestamps instead of returning pre-flush audit values.
			entityManager.refresh(tag);
		} catch (DataIntegrityViolationException exception) {
			throw translateNameConflict(exception);
		}
	}

	private RuntimeException translateNameConflict(DataIntegrityViolationException exception) {
		for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
			if (cause instanceof ConstraintViolationException violation
					&& "23505".equals(violation.getSQLState())
					&& "tags_name_key".equals(violation.getConstraintName())) {
				return new CustomException(ErrorCode.TAG_EXISTED);
			}
		}
		return exception;
	}

	private AdminTagResponse toResponse(Tag tag) {
		return AdminTagResponse.builder().id(tag.getId()).name(tag.getName())
				.description(tag.getDescription()).active(tag.isActive())
				.createdAt(tag.getCreatedAt()).createdBy(tag.getCreatedBy())
				.updatedAt(tag.getUpdatedAt()).updatedBy(tag.getUpdatedBy()).build();
	}
}
