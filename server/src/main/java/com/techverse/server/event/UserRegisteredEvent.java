package com.techverse.server.event;

public record UserRegisteredEvent(String fullName, String email) {
}
