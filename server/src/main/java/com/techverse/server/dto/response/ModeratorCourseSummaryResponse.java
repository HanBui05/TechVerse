package com.techverse.server.dto.response;

/** Queue row: working summary, author card and whether the author may still publish. */
public record ModeratorCourseSummaryResponse(
        CourseSummaryResponse course, ArticleAuthorResponse author, boolean authorEligible) {}
