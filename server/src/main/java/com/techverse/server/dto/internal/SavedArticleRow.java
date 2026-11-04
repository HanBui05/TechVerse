package com.techverse.server.dto.internal;

import java.time.Instant;

/** A visible snapshot row from the actor's saved list with its save time. */
public record SavedArticleRow(PublishedArticleRow article, Instant savedAt) {}
