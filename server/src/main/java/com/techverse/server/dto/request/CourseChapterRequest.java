package com.techverse.server.dto.request;

import jakarta.validation.constraints.*;

public record CourseChapterRequest(
        @NotNull @Size(max = 255) @Pattern(regexp = "(?s).*\\S.*") String title) {
    public CourseChapterRequest {
        if (title != null) title = title.strip();
    }
}
