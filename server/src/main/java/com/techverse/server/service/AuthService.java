package com.techverse.server.service;

import com.techverse.server.dto.internal.LoginTokens;
import com.techverse.server.dto.request.RegisterRequest;
import com.techverse.server.dto.request.LoginRequest;
import com.techverse.server.dto.response.RegisterResponse;

public interface AuthService {

	RegisterResponse register(RegisterRequest request);

	LoginTokens login(LoginRequest request);
}
