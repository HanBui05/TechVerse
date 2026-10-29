package com.techverse.server.service.impl;

import com.techverse.server.dto.request.AdminTopicFilter;
import com.techverse.server.dto.request.CreateTopicRequest;
import com.techverse.server.dto.request.UpdateTopicRequest;
import com.techverse.server.dto.request.UpdateTopicStatusRequest;
import com.techverse.server.dto.response.AdminTopicResponse;
import com.techverse.server.dto.response.AdminTopicSummaryResponse;
import com.techverse.server.dto.response.PageResponse;
import com.techverse.server.entity.Topic;
import com.techverse.server.entity.User;
import com.techverse.server.enums.RoleName;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.TopicRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.repository.specification.TopicSpecification;
import com.techverse.server.service.AdminTopicService;
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
public class AdminTopicServiceImpl implements AdminTopicService {
	private final TopicRepository topics;
	private final UserRepository users;

	@Override
	@Transactional
	public AdminTopicResponse create(UUID actorId, CreateTopicRequest request) {
		lockActiveAdmin(actorId);
		if (topics.existsByNameIgnoreCase(request.name())) {
			throw new CustomException(ErrorCode.TOPIC_EXISTED);
		}
		Topic topic = Topic.builder().name(request.name()).description(request.description()).build();
		try {
			topics.saveAndFlush(topic);
		} catch (DataIntegrityViolationException exception) {
			throw translateNameConflict(exception);
		}
		return toResponse(topic);
	}

	@Override
	@Transactional(readOnly = true)
	public PageResponse<AdminTopicSummaryResponse> getTopics(AdminTopicFilter filter) {
		var specification = TopicSpecification.hasKeyword(filter.getKeyword())
				.and(TopicSpecification.hasActiveStatus(filter.getActive()));
		Sort sort = Sort.by(filter.getDirection(), filter.getSortBy().getProperty())
				.and(Sort.by(filter.getDirection(), "id"));
		var page = topics.findAll(specification, PageRequest.of(filter.getPage(), filter.getSize(), sort));
		return PageResponse.from(page, page.getContent().stream().map(topic -> AdminTopicSummaryResponse.builder()
				.id(topic.getId()).name(topic.getName()).description(topic.getDescription()).active(topic.isActive())
				.createdAt(topic.getCreatedAt()).updatedAt(topic.getUpdatedAt()).build()).toList());
	}

	@Override
	@Transactional(readOnly = true)
	public AdminTopicResponse getTopic(UUID id) {
		return toResponse(topics.findById(id).orElseThrow(() -> new CustomException(ErrorCode.TOPIC_NOT_FOUND)));
	}

	@Override
	@Transactional
	public AdminTopicResponse update(UUID actorId, UUID id, UpdateTopicRequest request) {
		lockActiveAdmin(actorId);
		Topic topic = lockTopic(id);
		if (request.isNameProvided()) {
			if (topics.existsByNameIgnoreCaseAndIdNot(request.getName(), id)) {
				throw new CustomException(ErrorCode.TOPIC_EXISTED);
			}
			topic.updateName(request.getName());
		}
		if (request.isDescriptionProvided()) topic.updateDescription(request.getDescription());
		flushTopic();
		return toResponse(topic);
	}

	@Override
	@Transactional
	public AdminTopicResponse updateStatus(UUID actorId, UUID id, UpdateTopicStatusRequest request) {
		lockActiveAdmin(actorId);
		Topic topic = lockTopic(id);
		// No linked content changes: inactive retires the topic from future assignments only.
		if (topic.isActive() != request.active()) {
			topic.updateActiveStatus(request.active());
			flushTopic();
		}
		return toResponse(topic);
	}

	private void lockActiveAdmin(UUID actorId) {
		// User first, topic second, consistent with account locking and other admin writes.
		User actor = users.findByIdForAuthentication(actorId)
				.orElseThrow(() -> new CustomException(ErrorCode.ACCESS_DENIED));
		if (!actor.isActive() || actor.getUserRoles().stream()
				.noneMatch(assignment -> assignment.getRole().getName() == RoleName.ADMIN)) {
			throw new CustomException(ErrorCode.ACCESS_DENIED);
		}
	}

	private Topic lockTopic(UUID id) {
		return topics.findByIdForUpdate(id).orElseThrow(() -> new CustomException(ErrorCode.TOPIC_NOT_FOUND));
	}

	private void flushTopic() {
		try {
			topics.flush();
		} catch (DataIntegrityViolationException exception) {
			throw translateNameConflict(exception);
		}
	}

	private RuntimeException translateNameConflict(DataIntegrityViolationException exception) {
		for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
			if (cause instanceof ConstraintViolationException violation
					&& "23505".equals(violation.getSQLState())
					&& "topics_name_key".equals(violation.getConstraintName())) {
				return new CustomException(ErrorCode.TOPIC_EXISTED);
			}
		}
		return exception;
	}

	private AdminTopicResponse toResponse(Topic topic) {
		return AdminTopicResponse.builder().id(topic.getId()).name(topic.getName())
				.description(topic.getDescription()).active(topic.isActive())
				.createdAt(topic.getCreatedAt()).createdBy(topic.getCreatedBy())
				.updatedAt(topic.getUpdatedAt()).updatedBy(topic.getUpdatedBy()).build();
	}
}
