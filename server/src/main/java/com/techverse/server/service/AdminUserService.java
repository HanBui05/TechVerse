package com.techverse.server.service;

import com.techverse.server.dto.request.AdminUserFilter;
import com.techverse.server.dto.request.AdminUserStatusUpdateRequest;
import com.techverse.server.dto.response.AdminUserSummaryResponse;
import com.techverse.server.dto.response.AdminUserDetailResponse;
import com.techverse.server.dto.response.AdminUserStatusUpdateResponse;
import com.techverse.server.dto.response.PageResponse;
import java.util.UUID;

public interface AdminUserService {

	PageResponse<AdminUserSummaryResponse> getUsers(AdminUserFilter filter);

	AdminUserDetailResponse getUserDetails(UUID userId);

	AdminUserStatusUpdateResponse updateUserStatuses(UUID actorId, AdminUserStatusUpdateRequest request);
}
