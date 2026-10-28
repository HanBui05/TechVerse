package com.techverse.server.service;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

public interface TokenService {

	JwtDetails generateAccessToken(UUID userId, Set<RoleName> roles, String sessionId);

	JwtDetails generateRefreshToken(UUID userId, Set<RoleName> roles, String sessionId);

	void createSession(UUID userId, JwtDetails refreshToken);

	void saveToken(JwtDetails token, UUID userId, TokenType tokenType);

	Jwt decodeRefreshToken(String rawRefreshToken);

	boolean isTokenActive(Jwt jwt, TokenType tokenType);

	void deleteSession(UUID userId, String sessionId);

	void deleteToken(String jwtId);

	void deleteAllTokensByUserId(UUID userId);
}
