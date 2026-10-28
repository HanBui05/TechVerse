package com.techverse.server.dto.request;

import com.techverse.server.validation.annotation.MinimumAge;
import com.techverse.server.validation.annotation.PhoneNumber;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record UpdateMyProfileRequest(
		@Size(max = 150, message = "Full name must not exceed 150 characters")
		@Pattern(regexp = ".*\\S.*", message = "Full name must not be blank")
		String fullName,
		@Size(max = 20, message = "Phone number must not exceed 20 characters")
		@PhoneNumber(message = "Phone number must contain between 10 and 20 digits")
		@Schema(example = "+84912345678")
		String phoneNumber,
		@Past(message = "Date of birth must be in the past")
		@MinimumAge(value = 6, message = "User must be at least 6 years old")
		@Schema(type = "string", format = "date", example = "2004-05-24")
		LocalDate dateOfBirth
) {
}
