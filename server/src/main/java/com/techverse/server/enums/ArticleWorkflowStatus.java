package com.techverse.server.enums;

/** State of the author's working copy; independent of what readers can see. */
public enum ArticleWorkflowStatus {
    DRAFT,
    PENDING,
    PUBLISHED,
    CHANGES_REQUESTED
}
