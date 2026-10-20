package com.techverse.server.dto.request;

import com.techverse.server.validation.annotation.PasswordConfirmationMatches;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@PasswordConfirmationMatches
public record RegisterRequest(
		@NotBlank(message = "Full name is required")
		@Size(max = 150, message = "Full name must not exceed 150 characters")
		String fullName,
		@NotBlank(message = "Email is required")
		@Email(message = "Email must be valid")
		@Size(max = 254, message = "Email must not exceed 254 characters")
		String email,
		@NotBlank(message = "Password is required")
		@Size(min = 8, max = 72, message = "Password must contain between 8 and 72 characters")
		String password,
		@NotBlank(message = "Confirm password is required")
		String confirmPassword
) {
}
