package com.techverse.server.dto.response;

import lombok.Builder;

@Builder
public record VerifyResetOtpResponse(String resetToken, long expiresIn) { }
