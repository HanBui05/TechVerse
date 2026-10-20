package com.techverse.server.dto.response;

import com.techverse.server.enums.RoleName;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

public record RegisterResponse(
		UUID id,
		String fullName,
		String email,
		String phoneNumber,
		LocalDate dateOfBirth,
		Set<RoleName> roles
) {
}
