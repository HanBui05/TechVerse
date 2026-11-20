package com.techverse.server.enums;

public enum ExerciseType {
    MULTIPLE_CHOICE,
    FLASHCARD,
    /** Kept in the schema; the API rejects it. */
    CODE_BUG_FINDING,
    DEBUG_SCENARIO
}
