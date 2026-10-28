package com.techverse.server.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record VerifyResetOtpRequest(
        @NotBlank(message = "Email is required")
        @Email(message = "Email must be valid")
        @Size(max = 254, message = "Email must not exceed 254 characters")
        String email,
        @NotBlank(message = "OTP is required")
        @Pattern(regexp = "[0-9]{6}", message = "OTP must contain exactly 6 digits")
        @Schema(type = "string", example = "038291")
        String otp
) { }
