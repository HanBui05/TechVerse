package com.techverse.server.dto.response;

import java.time.Instant;

/** Author view of a course's learners: name, avatar and progress only; never email or money. */
public record CourseStudentsResponse(PageResponse<Student> students, Summary summary) {
    public record Student(
            String fullName,
            String avatarUrl,
            Instant enrolledAt,
            Instant lastAccessedAt,
            int completedLessons,
            int totalLessons) {}

    /** Counts over every active student, ignoring the list filters. */
    public record Summary(long total, long notStarted, long completed) {}
}
