package com.techverse.server.service;

import com.techverse.server.dto.request.UpdateMyProfileRequest;
import com.techverse.server.dto.response.MyProfileResponse;
import java.util.UUID;

public interface UserService {

	MyProfileResponse getMyProfile(UUID userId);

	MyProfileResponse updateMyProfile(UUID userId, UpdateMyProfileRequest request);
}
