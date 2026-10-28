package com.techverse.server.listener;

import com.techverse.server.event.PasswordResetOtpEvent;
import com.techverse.server.service.EmailService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class PasswordResetEmailListener {
    private final EmailService emailService;

    @Async("emailTaskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendOtp(PasswordResetOtpEvent event) {
        emailService.sendEmailBySendGrid(event.email(), "reset-password-otp",
                Map.of("fullName", event.fullName(), "otp", event.otp(), "expiresInMinutes", 10));
    }
}
