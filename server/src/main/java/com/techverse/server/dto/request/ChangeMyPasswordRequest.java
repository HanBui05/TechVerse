package com.techverse.server.dto.request;

import com.techverse.server.dto.internal.PasswordConfirmation;
import com.techverse.server.validation.annotation.PasswordConfirmationMatches;
import com.techverse.server.validation.annotation.Utf8ByteLength;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@PasswordConfirmationMatches
public record ChangeMyPasswordRequest(
		@NotBlank(message = "Current password is required")
		String currentPassword,
		@NotBlank(message = "New password is required")
		@Size(min = 8, max = 72, message = "Password must contain between 8 and 72 characters")
		@Utf8ByteLength(max = 72, message = "Password must not exceed 72 UTF-8 bytes")
		String newPassword,
		@NotBlank(message = "Confirm password is required")
		@Size(max = 72, message = "Confirm password must not exceed 72 characters")
		String confirmPassword
) implements PasswordConfirmation {
	@Override
	public String password() { return newPassword; }
}
