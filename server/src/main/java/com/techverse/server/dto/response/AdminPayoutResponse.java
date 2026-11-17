package com.techverse.server.dto.response;

import java.time.Instant;
import java.util.UUID;

/**
 * A recorded payout as the Admin sees it: full account snapshot and who recorded it. {@code accountChanged}
 * is set only when recording (the account sent differs from the author's current one), null in lists.
 */
public record AdminPayoutResponse(
        UUID id,
        UUID authorId,
        String authorName,
        long amount,
        String bankReference,
        String bankId,
        String bankName,
        String accountNo,
        String accountName,
        UUID recordedById,
        String recordedByName,
        Instant createdAt,
        Boolean accountChanged) {

    /** What the platform owes one author; {@code vietQr} is null without an account or with nothing owed. */
    public record AuthorBalance(
            UUID authorId,
            String fullName,
            String email,
            long earnedAmount,
            long paidOutAmount,
            long balanceAmount,
            PayoutResponse.Account account,
            OrderResponse.VietQr vietQr) {}
}
