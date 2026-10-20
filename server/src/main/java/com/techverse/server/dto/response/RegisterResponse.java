package com.techverse.server.dto.response;

import com.techverse.server.enums.RoleName;
import java.util.Set;
import java.util.UUID;

public record RegisterResponse(UUID id, String fullName, String email, Set<RoleName> roles) {
}
