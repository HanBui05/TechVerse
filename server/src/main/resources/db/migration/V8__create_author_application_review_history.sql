-- Append-only record of every APPROVED/REJECTED decision, so resubmission no longer erases earlier feedback.
-- No backfill: the dev database was reset (D-022); history starts with the first review after V8.
CREATE TABLE author_application_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Cascade only when the whole profile (and its owner) is hard-deleted.
    author_profile_id uuid NOT NULL REFERENCES author_profiles(id) ON DELETE CASCADE,
    application_version bigint NOT NULL,
    decision varchar(20) NOT NULL,
    review_note text,
    reviewed_at timestamptz NOT NULL,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewer_name_snapshot varchar(150) NOT NULL,
    bio_snapshot text NOT NULL,
    expertise_snapshot varchar(255) NOT NULL,
    portfolio_url_snapshot text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_author_application_reviews_decision CHECK (decision IN ('APPROVED', 'REJECTED')),
    -- NULL must be rejected explicitly: btrim(NULL) <> '' evaluates to NULL, which a CHECK accepts.
    CONSTRAINT ck_author_application_reviews_rejection_note
        CHECK (decision <> 'REJECTED' OR (review_note IS NOT NULL AND btrim(review_note) <> '')),
    CONSTRAINT ck_author_application_reviews_version CHECK (application_version >= 0),
    CONSTRAINT uk_author_application_reviews_profile_version UNIQUE (author_profile_id, application_version)
);

CREATE INDEX idx_author_application_reviews_profile_order
    ON author_application_reviews (author_profile_id, reviewed_at DESC, application_version DESC);
