package com.techverse.server.enums;

/** Readability of the latest approved snapshot. */
public enum ArticlePublicationStatus {
    UNPUBLISHED,
    PUBLISHED,
    AUTHOR_HIDDEN,
    HIDDEN,
    AUTHOR_DELETED,
    REMOVED;

    public boolean isTerminal() {
        return this == AUTHOR_DELETED || this == REMOVED;
    }
}
