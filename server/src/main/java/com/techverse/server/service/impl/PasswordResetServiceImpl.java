package com.techverse.server.service.impl;

import com.techverse.server.dto.request.ResetPasswordRequest;
import com.techverse.server.dto.response.VerifyResetOtpResponse;
import com.techverse.server.entity.User;
import com.techverse.server.event.PasswordResetOtpEvent;
import com.techverse.server.exception.CustomException;
import com.techverse.server.exception.ErrorCode;
import com.techverse.server.repository.PasswordResetRepository;
import com.techverse.server.repository.UserRepository;
import com.techverse.server.service.PasswordResetService;
import com.techverse.server.service.TokenService;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetServiceImpl implements PasswordResetService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final PasswordResetRepository resets;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final ApplicationEventPublisher events;
    private final SecretKeySpec hmacKey;

    public PasswordResetServiceImpl(PasswordResetRepository resets, UserRepository users,
            PasswordEncoder passwordEncoder, TokenService tokenService, ApplicationEventPublisher events,
            @Value("${password-reset.secret}") String secret) {
        if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("Password reset secret must contain at least 32 bytes");
        }
        this.resets = resets;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.events = events;
        this.hmacKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    @Override
    @Transactional
    public void forgotPassword(String email, String clientIp) {
        String normalized = normalize(email);
        String emailHash = emailHash(normalized);
        if (!resets.allowForgot(emailHash, hmac("ip:" + clientIp))) return;
        // Generate/hash before the account lookup, for both known and unknown addresses.
        String otp = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        String otpHash = hmac("otp:" + normalized + ":" + otp);
        users.findByEmailForAuthentication(normalized).filter(this::eligible).ifPresent(user -> {
            resets.issue(emailHash, user.getId(), otpHash);
            events.publishEvent(new PasswordResetOtpEvent(user.getFullName(), user.getEmail(), otp));
        });
    }

    @Override
    public VerifyResetOtpResponse verifyOtp(String email, String otp, String clientIp) {
        String normalized = normalize(email);
        String emailHash = emailHash(normalized);
        resets.checkVerificationLimits(emailHash, hmac("ip:" + clientIp));
        byte[] random = new byte[32];
        RANDOM.nextBytes(random);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        if (!resets.verify(emailHash, hmac("otp:" + normalized + ":" + otp), sha256(token))) {
            throw new CustomException(ErrorCode.INVALID_RESET_OTP);
        }
        return VerifyResetOtpResponse.builder().resetToken(token)
                .expiresIn(PasswordResetRepository.TTL_SECONDS).build();
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String grantHash = sha256(request.resetToken());
        var userId = resets.findUserId(grantHash).orElseThrow(this::invalidGrant);
        // The same lock serializes login, refresh, logout and admin account locking.
        User user = users.findByIdForAuthentication(userId).filter(this::eligible).orElseThrow(this::invalidGrant);
        String encoded = passwordEncoder.encode(request.newPassword());
        if (!resets.consume(emailHash(normalize(user.getEmail())), grantHash, userId)) throw invalidGrant();
        // Fail closed: never restore a consumed grant on rollback or infrastructure failure.
        user.changePassword(encoded);
        users.saveAndFlush(user);
        tokenService.deleteAllTokensByUserId(userId);
    }

    private boolean eligible(User user) { return user.isActive() && user.getPassword() != null; }
    private String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }
    private String emailHash(String email) { return hmac("email:" + email); }
    private CustomException invalidGrant() { return new CustomException(ErrorCode.INVALID_PASSWORD_RESET_TOKEN); }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(hmacKey);
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to hash password reset data", exception);
        }
    }

    private String sha256(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to hash password reset token", exception);
        }
    }
}
