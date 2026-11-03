package com.techverse.server.user;

import static org.assertj.core.api.Assertions.assertThat;

import com.techverse.server.dto.request.ChangeMyPasswordRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import jakarta.validation.ValidatorFactory;

class ChangeMyPasswordRequestTest {

	private static ValidatorFactory factory;
	private static Validator validator;

	@BeforeAll
	static void setUp() {
		factory = Validation.buildDefaultValidatorFactory();
		validator = factory.getValidator();
	}

	@AfterAll
	static void tearDown() {
		factory.close();
	}

	@Test
	void acceptsAValidRequest() {
		assertThat(violations(new ChangeMyPasswordRequest("old-secret", "NewSecure123!", "NewSecure123!"))).isEmpty();
	}

	@Test
	void requiresAllThreeFields() {
		assertThat(violations(new ChangeMyPasswordRequest(null, null, null)))
				.contains("currentPassword", "newPassword", "confirmPassword");
		assertThat(violations(new ChangeMyPasswordRequest(" ", " ", " ")))
				.contains("currentPassword", "newPassword", "confirmPassword");
	}

	@Test
	void rejectsNewPasswordOutsideEightToSeventyTwoCharacters() {
		assertThat(violations(new ChangeMyPasswordRequest("old", "Short1!", "Short1!"))).containsExactly("newPassword");
		String tooLong = "a".repeat(73);
		assertThat(violations(new ChangeMyPasswordRequest("old", tooLong, tooLong))).contains("newPassword");
		String maxLength = "a".repeat(72);
		assertThat(violations(new ChangeMyPasswordRequest("old", maxLength, maxLength))).isEmpty();
	}

	@Test
	void rejectsNewPasswordOverSeventyTwoUtf8Bytes() {
		String multiByte = "é".repeat(37); // 37 chars, 74 bytes
		assertThat(violations(new ChangeMyPasswordRequest("old", multiByte, multiByte))).containsExactly("newPassword");
	}

	@Test
	void rejectsMismatchedConfirmation() {
		assertThat(violations(new ChangeMyPasswordRequest("old", "NewSecure123!", "Different123!")))
				.containsExactly("");
	}

	private Set<String> violations(ChangeMyPasswordRequest request) {
		return validator.validate(request).stream()
				.map(ConstraintViolation::getPropertyPath)
				.map(Object::toString)
				.collect(Collectors.toSet());
	}
}
