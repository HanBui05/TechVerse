package com.techverse.server.event;

// Never log this event: it carries the plaintext OTP only for delivery.
public record PasswordResetOtpEvent(String fullName, String email, String otp) { }
