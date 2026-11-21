-- Interview practice: author hide state, optimistic version, AI flag, learner marks.
-- No backfill (D-022): stop when interview_questions already holds rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM interview_questions) THEN
        RAISE EXCEPTION 'interview_questions already contains data; migrate it by hand before applying V20';
    END IF;
END $$;

ALTER TABLE interview_questions DROP CONSTRAINT ck_interview_questions_status;
ALTER TABLE interview_questions ADD CONSTRAINT ck_interview_questions_status
    CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'AUTHOR_HIDDEN', 'REMOVED'));

ALTER TABLE interview_questions
    ADD COLUMN hidden_from_status varchar(30),
    ADD COLUMN ai_assisted boolean NOT NULL DEFAULT false,
    ADD COLUMN version integer NOT NULL DEFAULT 0;

ALTER TABLE interview_questions
    ADD CONSTRAINT ck_interview_questions_hidden_from
        CHECK ((status = 'HIDDEN') = (hidden_from_status IS NOT NULL)
               AND (hidden_from_status IS NULL OR hidden_from_status IN ('PUBLISHED', 'AUTHOR_HIDDEN'))),
    ADD CONSTRAINT ck_interview_questions_version CHECK (version >= 0);

-- One row per learner and question; both stamps NULL means "not marked".
CREATE TABLE interview_question_marks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id uuid NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    reviewed_at timestamptz,
    saved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_interview_question_marks_user_question UNIQUE (user_id, question_id)
);

CREATE INDEX idx_interview_question_marks_user_saved ON interview_question_marks (user_id, saved_at);

CREATE TRIGGER trg_interview_question_marks_set_updated_at
BEFORE UPDATE ON interview_question_marks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
