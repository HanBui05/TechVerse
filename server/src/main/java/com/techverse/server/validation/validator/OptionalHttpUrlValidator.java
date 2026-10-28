package com.techverse.server.validation.validator;

import com.techverse.server.validation.annotation.OptionalHttpUrl;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.net.URI;
import java.net.URISyntaxException;

public class OptionalHttpUrlValidator implements ConstraintValidator<OptionalHttpUrl, String> {

	@Override
	public boolean isValid(String value, ConstraintValidatorContext context) {
		if (value == null || value.isBlank()) {
			return true;
		}

		try {
			URI uri = new URI(value);
			String scheme = uri.getScheme();
			return uri.getHost() != null
					&& ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme));
		} catch (URISyntaxException exception) {
			return false;
		}
	}
}
