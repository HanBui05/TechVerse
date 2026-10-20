package com.techverse.server.service;

import com.techverse.server.dto.request.RegisterRequest;
import com.techverse.server.dto.response.RegisterResponse;

public interface AuthService {

	RegisterResponse register(RegisterRequest request);
}
