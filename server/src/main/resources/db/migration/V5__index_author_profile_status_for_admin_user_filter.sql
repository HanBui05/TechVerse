CREATE INDEX IF NOT EXISTS idx_author_profiles_status_user_id
    ON author_profiles (status, user_id);
