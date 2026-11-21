-- Forum Q&A and reports: topic, accepted answer, edit stamp and moderation columns on forum_posts.
-- No backfill (D-022): stop when forum_posts or reports already holds rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM forum_posts) THEN
        RAISE EXCEPTION 'forum_posts already contains data; migrate it by hand before applying V21';
    END IF;
    IF EXISTS (SELECT 1 FROM reports) THEN
        RAISE EXCEPTION 'reports already contains data; migrate it by hand before applying V21';
    END IF;
END $$;

ALTER TABLE forum_posts
    ADD COLUMN topic_id uuid REFERENCES topics(id) ON DELETE RESTRICT,
    ADD COLUMN accepted_answer_id uuid REFERENCES forum_posts(id) ON DELETE SET NULL,
    ADD COLUMN edited_at timestamptz,
    ADD COLUMN hidden_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN hidden_at timestamptz,
    ADD COLUMN moderation_note text;

ALTER TABLE forum_posts
    ADD CONSTRAINT ck_forum_posts_topic CHECK ((parent_id IS NULL) = (topic_id IS NOT NULL)),
    ADD CONSTRAINT ck_forum_posts_accepted_answer CHECK (parent_id IS NULL OR accepted_answer_id IS NULL);

CREATE INDEX idx_forum_posts_topic_created ON forum_posts (topic_id, created_at DESC) WHERE parent_id IS NULL;
CREATE INDEX idx_forum_posts_user_created ON forum_posts (user_id, created_at DESC);
CREATE INDEX idx_reports_target ON reports (target_type, target_id);
