package com.techverse.server.listener;

import com.techverse.server.event.UserRegisteredEvent;
import com.techverse.server.service.EmailService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class RegistrationEmailListener {

	private final EmailService emailService;

	@Async("emailTaskExecutor")
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void sendRegistrationSuccessEmail(UserRegisteredEvent event) {
		emailService.sendEmailBySendGrid(
				event.email(),
				"register-success",
				Map.of(
						"fullName", event.fullName(),
						"email", event.email()
				)
		);
	}
}
