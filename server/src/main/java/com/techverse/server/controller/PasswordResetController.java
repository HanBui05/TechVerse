package com.techverse.server.controller;

import com.techverse.server.dto.request.ForgotPasswordRequest;
import com.techverse.server.dto.request.ResetPasswordRequest;
import com.techverse.server.dto.request.VerifyResetOtpRequest;
import com.techverse.server.dto.response.ApiResponse;
import com.techverse.server.dto.response.VerifyResetOtpResponse;
import com.techverse.server.service.PasswordResetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication")
public class PasswordResetController {
    private final PasswordResetService passwordResetService;

    @PostMapping("/forgot-password")
    @Operation(summary = "Request a six-digit password reset OTP by email")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest servletRequest) {
        passwordResetService.forgotPassword(request.email(), servletRequest.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.<Void>builder()
                .status(200).message("If the account is eligible, password reset instructions will be sent to your email")
                .build());
    }

    @PostMapping("/verify-reset-otp")
    @Operation(summary = "Consume the OTP and issue a one-time password reset token (10 minutes)")
    public ResponseEntity<ApiResponse<VerifyResetOtpResponse>> verifyOtp(
            @Valid @RequestBody VerifyResetOtpRequest request, HttpServletRequest servletRequest) {
        var result = passwordResetService.verifyOtp(request.email(), request.otp(), servletRequest.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.<VerifyResetOtpResponse>builder().status(200)
                        .message("OTP verified successfully").data(result).build());
    }

    @PostMapping("/reset-password")
    @Operation(summary = "Consume the reset token, change password, and revoke all sessions")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ApiResponse.<Void>builder()
                .status(200).message("Password reset successfully. Please log in again").build());
    }
}
