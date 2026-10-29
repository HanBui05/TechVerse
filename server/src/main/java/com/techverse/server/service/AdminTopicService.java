package com.techverse.server.service;

import com.techverse.server.dto.request.AdminTopicFilter;
import com.techverse.server.dto.request.CreateTopicRequest;
import com.techverse.server.dto.request.UpdateTopicRequest;
import com.techverse.server.dto.request.UpdateTopicStatusRequest;
import com.techverse.server.dto.response.AdminTopicResponse;
import com.techverse.server.dto.response.AdminTopicSummaryResponse;
import com.techverse.server.dto.response.PageResponse;
import java.util.UUID;

public interface AdminTopicService {
	AdminTopicResponse create(UUID actorId, CreateTopicRequest request);
	PageResponse<AdminTopicSummaryResponse> getTopics(AdminTopicFilter filter);
	AdminTopicResponse getTopic(UUID id);
	AdminTopicResponse update(UUID actorId, UUID id, UpdateTopicRequest request);
	AdminTopicResponse updateStatus(UUID actorId, UUID id, UpdateTopicStatusRequest request);
}
