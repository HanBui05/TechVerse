-- Exercise practice: author hide state, optimistic version, AI flag, attempt idempotency key.
-- No backfill (D-022): stop when any exercise table already holds rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM exercise_sets)
       OR EXISTS (SELECT 1 FROM exercise_questions)
       OR EXISTS (SELECT 1 FROM exercise_attempts) THEN
        RAISE EXCEPTION 'exercise tables already contain data; migrate them by hand before applying V19';
    END IF;
END $$;

ALTER TABLE exercise_sets DROP CONSTRAINT ck_exercise_sets_status;
ALTER TABLE exercise_sets ADD CONSTRAINT ck_exercise_sets_status
    CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'AUTHOR_HIDDEN', 'REMOVED'));

ALTER TABLE exercise_sets
    ADD COLUMN hidden_from_status varchar(30),
    ADD COLUMN ai_assisted boolean NOT NULL DEFAULT false,
    ADD COLUMN version integer NOT NULL DEFAULT 0;

ALTER TABLE exercise_sets
    ADD CONSTRAINT ck_exercise_sets_hidden_from
        CHECK ((status = 'HIDDEN') = (hidden_from_status IS NOT NULL)
               AND (hidden_from_status IS NULL OR hidden_from_status IN ('PUBLISHED', 'AUTHOR_HIDDEN'))),
    ADD CONSTRAINT ck_exercise_sets_version CHECK (version >= 0);

-- Time limits are out of scope: replace "NULL or positive" with "always NULL".
ALTER TABLE exercise_sets DROP CONSTRAINT ck_exercise_sets_time_limit;
ALTER TABLE exercise_sets ADD CONSTRAINT ck_exercise_sets_time_limit CHECK (time_limit_seconds IS NULL);

ALTER TABLE exercise_attempts
    ADD COLUMN idempotency_key uuid NOT NULL,
    ADD CONSTRAINT uq_exercise_attempts_user_key UNIQUE (user_id, idempotency_key);
