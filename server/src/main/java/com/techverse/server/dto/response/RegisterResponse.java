package com.techverse.server.dto.response;

import com.techverse.server.enums.RoleName;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RegisterResponse {

	private final UUID id;
	private final String fullName;
	private final String email;
	private final String phoneNumber;
	private final LocalDate dateOfBirth;
	private final Set<RoleName> roles;
}
