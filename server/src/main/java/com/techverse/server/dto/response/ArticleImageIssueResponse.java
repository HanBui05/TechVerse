package com.techverse.server.dto.response;

import lombok.Builder;

/**
 * A Markdown image that is not yet a managed upload. Clients replace by {@code source} plus
 * one-based {@code occurrence}; one-based line/column are for display only.
 */
@Builder
public record ArticleImageIssueResponse(
        Type type, String alt, String source, int occurrence, int line, int column, String filename) {
    public enum Type {
        /** Relative/local path such as images/a.png. */
        LOCAL_FILE,
        /** Absolute URL hosted elsewhere. */
        EXTERNAL_URL,
        /** Cloudinary URL that is not this article's managed asset. */
        UNMANAGED_ASSET
    }
}
