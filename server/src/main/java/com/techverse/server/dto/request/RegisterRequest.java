package com.techverse.server.dto.request;

import com.techverse.server.validation.annotation.PasswordConfirmationMatches;
import com.techverse.server.validation.annotation.Utf8ByteLength;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

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
		@Utf8ByteLength(max = 72, message = "Password must not exceed 72 UTF-8 bytes")
		String password,
		@NotBlank(message = "Confirm password is required")
		String confirmPassword,
		@Size(max = 20, message = "Phone number must not exceed 20 characters")
		@Schema(example = "+84912345678")
		String phoneNumber,
		@Past(message = "Date of birth must be in the past")
		@Schema(type = "string", format = "date", example = "2004-05-24")
		LocalDate dateOfBirth
) {
}
