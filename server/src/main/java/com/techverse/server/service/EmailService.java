package com.techverse.server.service;

import java.util.Map;

public interface EmailService {

	void sendEmailBySendGrid(String toEmail, String templateKey, Map<String, Object> dynamicData);
}
