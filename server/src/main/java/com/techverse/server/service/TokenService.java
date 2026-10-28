package com.techverse.server.service;

import com.techverse.server.dto.internal.JwtDetails;
import com.techverse.server.enums.RoleName;
import com.techverse.server.enums.TokenType;
import java.util.Set;
import java.util.UUID;
import java.util.Optional;
import org.springframework.security.oauth2.jwt.Jwt;

public interface TokenService {

	JwtDetails generateAccessToken(UUID userId, Set<RoleName> roles);

	JwtDetails generateRefreshToken(UUID userId, Set<RoleName> roles);

	void saveToken(JwtDetails token, UUID userId, TokenType tokenType);

	Jwt decodeRefreshToken(String rawRefreshToken);

	Jwt decodeTokenForLogout(String rawToken);

	Optional<UUID> findUserId(String jwtId, TokenType tokenType);

	void deleteToken(String jwtId);

	void deleteAllTokensByUserId(UUID userId);
}
