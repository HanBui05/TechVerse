-- Preserve initial application review and retain the latest suspension/restoration cycle.
ALTER TABLE author_profiles
    ADD COLUMN suspension_reason text,
    ADD COLUMN suspended_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN suspended_at timestamptz,
    ADD COLUMN restoration_note text,
    ADD COLUMN restored_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN restored_at timestamptz;
