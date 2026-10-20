package com.techverse.server.service.impl;

import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Personalization;
import com.techverse.server.properties.SendGridProperties;
import com.techverse.server.service.EmailService;
import java.io.IOException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class SendGridEmailService implements EmailService {

	private final SendGrid sendGrid;
	private final SendGridProperties sendGridProperties;

	@Override
	public void sendEmailBySendGrid(String toEmail, String templateKey, Map<String, Object> dynamicData) {
		String templateId = sendGridProperties.templateId().get(templateKey);
		if (templateId == null || templateId.isBlank()) {
			log.error("No SendGrid template is configured for key {}", templateKey);
			return;
		}

		Mail mail = new Mail();
		mail.setFrom(new Email(sendGridProperties.fromEmail(), sendGridProperties.fromName()));
		mail.setTemplateId(templateId);

		Personalization personalization = new Personalization();
		personalization.addTo(new Email(toEmail));
		dynamicData.forEach(personalization::addDynamicTemplateData);
		mail.addPersonalization(personalization);

		Request request = new Request();
		request.setMethod(Method.POST);
		request.setEndpoint("mail/send");

		try {
			request.setBody(mail.build());
			Response response = sendGrid.api(request);
			if (response.getStatusCode() >= 200 && response.getStatusCode() < 300) {
				log.info("SendGrid accepted {} email for {} with status {}", templateKey, toEmail, response.getStatusCode());
				return;
			}
			log.error("SendGrid rejected {} email for {} with status {}", templateKey, toEmail, response.getStatusCode());
		} catch (IOException exception) {
			log.error("SendGrid request failed for {} email to {}", templateKey, toEmail, exception);
		}
	}
}
