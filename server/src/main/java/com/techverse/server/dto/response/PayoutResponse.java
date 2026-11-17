package com.techverse.server.dto.response;

import java.time.Instant;
import java.util.List;

/** One payout as the author sees it; the account number keeps only its last four characters. */
public record PayoutResponse(long amount, String bankReference, String accountNo, Instant createdAt) {

    public record Bank(String id, String name) {}

    public record Account(String bankId, String bankName, String accountNo, String accountName, Instant updatedAt) {}

    /** {@code account} is null until the author declares one; {@code banks} is the only accepted list. */
    public record AccountView(Account account, List<Bank> banks) {}
}
