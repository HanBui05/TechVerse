package com.techverse.server.dto.response;

import java.util.UUID;

/** Marketplace revenue: {@code totals} and {@code courses} follow the date filter, {@code ledger} is all time. */
public record AdminRevenueResponse(Totals totals, Ledger ledger, PageResponse<CourseRow> courses) {

    public record Totals(long itemCount, long grossAmount, long platformAmount, long authorAmount) {}

    /** {@code owedAmount = earnedAmount - paidOutAmount}, summed over every author. */
    public record Ledger(long earnedAmount, long paidOutAmount, long owedAmount) {}

    public record CourseRow(
            UUID courseId, String courseTitle, UUID authorId, String authorName,
            long itemCount, long grossAmount, long platformAmount, long authorAmount) {}
}
