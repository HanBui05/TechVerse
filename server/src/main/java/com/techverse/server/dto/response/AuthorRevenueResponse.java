package com.techverse.server.dto.response;

import com.techverse.server.entity.OrderItem;

import java.time.Instant;
import java.util.UUID;

/** Author's revenue from PAID items of their courses, using the order-time snapshot; no buyer data. */
public record AuthorRevenueResponse(Totals totals, PageResponse<Item> items) {

    /** {@code balanceAmount = authorAmount - paidOutAmount}, both read in one statement. */
    public record Totals(
            long itemCount, long grossAmount, long platformAmount, long authorAmount, long paidOutAmount, long balanceAmount) {}

    /** One course with sales in the filter range; the title is the current one. */
    public record CourseRow(
            UUID courseId, String courseTitle, long itemCount, long grossAmount, long platformAmount, long authorAmount) {}

    public record Item(
            UUID courseId,
            String courseTitle,
            Instant paidAt,
            long unitPriceAmount,
            int commissionRateBps,
            long commissionAmount,
            long authorNetAmount) {

        public static Item of(OrderItem i) {
            return new Item(i.getCourseId(), i.getCourseTitleSnapshot(), i.getOrder().getPaidAt(), i.getUnitPriceAmount(),
                    i.getCommissionRateBps(), i.getCommissionAmount(), i.getAuthorNetAmount());
        }
    }
}
