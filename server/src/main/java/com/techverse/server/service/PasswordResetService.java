package com.techverse.server.service;

import com.techverse.server.dto.request.ResetPasswordRequest;
import com.techverse.server.dto.response.VerifyResetOtpResponse;

public interface PasswordResetService {
    void forgotPassword(String email, String clientIp);
    VerifyResetOtpResponse verifyOtp(String email, String otp, String clientIp);
    void resetPassword(ResetPasswordRequest request);
}
