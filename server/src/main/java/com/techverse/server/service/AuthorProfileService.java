package com.techverse.server.service;

import com.techverse.server.dto.request.ApplyAuthorProfileRequest;
import com.techverse.server.dto.response.AuthorProfileResponse;
import com.techverse.server.dto.response.MyAuthorProfileResponse;
import java.util.UUID;

public interface AuthorProfileService {

	AuthorProfileResponse apply(UUID userId, ApplyAuthorProfileRequest request);

	MyAuthorProfileResponse getMyProfile(UUID userId);
}
