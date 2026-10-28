package com.techverse.server.service;

import com.techverse.server.dto.internal.LoginTokens;
import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.dto.internal.SocialProfile;
import com.techverse.server.dto.request.RegisterRequest;
import com.techverse.server.dto.request.LoginRequest;
import com.techverse.server.dto.response.RegisterResponse;
import java.util.UUID;

public interface AuthService {

	RegisterResponse register(RegisterRequest request);

	LoginTokens login(LoginRequest request);

	JwtDetails authenticateSocialAccount(SocialProfile profile);

	LoginTokens refresh(String rawRefreshToken);

	void logout(UUID userId, String sessionId);

	void logoutAll(UUID userId);
}
