package com.techverse.server.service;

import com.techverse.server.dto.request.AdminAuthorApplicationFilter;
import com.techverse.server.dto.request.ReviewAuthorApplicationRequest;
import com.techverse.server.dto.request.SuspendAuthorRequest;
import com.techverse.server.dto.request.RestoreAuthorRequest;
import com.techverse.server.dto.response.AdminAuthorApplicationDetailResponse;
import com.techverse.server.dto.response.AdminAuthorApplicationSummaryResponse;
import com.techverse.server.dto.response.PageResponse;
import java.util.UUID;

public interface AdminAuthorApplicationService {
	PageResponse<AdminAuthorApplicationSummaryResponse> getApplications(AdminAuthorApplicationFilter filter);
	AdminAuthorApplicationDetailResponse getApplication(UUID id);
	AdminAuthorApplicationDetailResponse review(UUID actorId, UUID id, ReviewAuthorApplicationRequest request);
	AdminAuthorApplicationDetailResponse suspend(UUID actorId, UUID id, SuspendAuthorRequest request);
	AdminAuthorApplicationDetailResponse restore(UUID actorId, UUID id, RestoreAuthorRequest request);
}
