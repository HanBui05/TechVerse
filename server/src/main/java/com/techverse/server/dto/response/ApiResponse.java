package com.techverse.server.dto.response;

public record ApiResponse<T>(int status, String message, T data) {
}
