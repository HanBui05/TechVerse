package com.techverse.server.enums;

/** Target draft size; word ranges are guidance for the model, not a guarantee. */
public enum AiArticleLength {
    SHORT("800-1200"),
    MEDIUM("1500-2500"),
    LONG("3000-4500");

    private final String targetWords;

    AiArticleLength(String targetWords) {
        this.targetWords = targetWords;
    }

    public String targetWords() {
        return targetWords;
    }
}
