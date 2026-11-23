package com.techverse.server.dto.response;

/** Counts for the Admin and Moderator overview pages. Two separate shapes: revenue never reaches the Moderator one. */
public final class DashboardResponse {
    private DashboardResponse() {}

    public record Admin(Users users, Authors authors, Content content, Orders orders, Revenue revenue) {}

    public record Users(long total, long active, long locked, long newLast7Days) {}

    public record Authors(long approved, long suspended, long pendingApplications) {}

    public record Content(long articles, long courses, long exerciseSets, long interviewQuestions, long forumQuestions) {}

    public record Orders(long awaitingConfirmation, long needsReconciliation) {}

    public record Revenue(Period allTime, Period last30Days) {}

    public record Period(long paidOrders, long grossAmount, long platformAmount, long authorAmount) {}

    public record Moderator(Pending pending, Reports reports) {}

    public record Pending(long articles, long courses, long exerciseSets, long interviewQuestions) {}

    public record Reports(long open, long hiddenPosts) {}
}
