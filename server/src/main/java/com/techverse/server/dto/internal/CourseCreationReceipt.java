package com.techverse.server.dto.internal;

import java.util.UUID;

/** Idempotent create of a course or lesson; {@code response} is the serialized 201 body. */
public record CourseCreationReceipt(String fingerprint, UUID resourceId, String response, boolean complete) {}
