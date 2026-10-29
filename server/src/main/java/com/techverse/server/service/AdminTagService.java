package com.techverse.server.service;

import com.techverse.server.dto.request.AdminTagFilter;
import com.techverse.server.dto.request.CreateTagRequest;
import com.techverse.server.dto.request.UpdateTagRequest;
import com.techverse.server.dto.request.UpdateTagStatusRequest;
import com.techverse.server.dto.response.AdminTagResponse;
import com.techverse.server.dto.response.AdminTagSummaryResponse;
import com.techverse.server.dto.response.PageResponse;
import java.util.UUID;

public interface AdminTagService {
	AdminTagResponse create(UUID actorId, CreateTagRequest request);
	PageResponse<AdminTagSummaryResponse> getTags(AdminTagFilter filter);
	AdminTagResponse getTag(UUID id);
	AdminTagResponse update(UUID actorId, UUID id, UpdateTagRequest request);
	AdminTagResponse updateStatus(UUID actorId, UUID id, UpdateTagStatusRequest request);
}
