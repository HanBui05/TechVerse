package com.techverse.server.dto.request;

import com.techverse.server.validation.annotation.MinimumAge;
import com.techverse.server.validation.annotation.PhoneNumber;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.Getter;

/** JSON Merge Patch: Jackson calls a setter only for fields present in the body, including explicit null. */
public class UpdateMyProfileRequest {

	@Getter
	@Size(max = 150, message = "Full name must not exceed 150 characters")
	@Pattern(regexp = ".*\\S.*", message = "Full name must not be blank")
	private String fullName;

	@Getter
	@Size(max = 20, message = "Phone number must not exceed 20 characters")
	@PhoneNumber(message = "Phone number must contain between 10 and 20 digits")
	@Schema(example = "+84912345678")
	private String phoneNumber;

	@Getter
	@Past(message = "Date of birth must be in the past")
	@MinimumAge(value = 6, message = "User must be at least 6 years old")
	@Schema(type = "string", format = "date", example = "2004-05-24")
	private LocalDate dateOfBirth;

	// Plain accessors (not bean getters) so Jackson cannot bind these flags from the request body.
	private boolean fullNamePresent;
	private boolean phoneNumberPresent;
	private boolean dateOfBirthPresent;

	public void setFullName(String fullName) {
		// An explicit null cannot clear the name: map it to "" so the blank check rejects it.
		this.fullName = fullName == null ? "" : fullName;
		this.fullNamePresent = true;
	}

	public void setPhoneNumber(String phoneNumber) {
		this.phoneNumber = phoneNumber;
		this.phoneNumberPresent = true;
	}

	public void setDateOfBirth(LocalDate dateOfBirth) {
		this.dateOfBirth = dateOfBirth;
		this.dateOfBirthPresent = true;
	}

	public boolean hasFullName() { return fullNamePresent; }

	public boolean hasPhoneNumber() { return phoneNumberPresent; }

	public boolean hasDateOfBirth() { return dateOfBirthPresent; }
}
