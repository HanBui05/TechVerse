-- Forum reactions: one per user and post (question or answer); updated_at is when the current type was chosen.
CREATE TABLE forum_post_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    type varchar(10) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_forum_post_reactions_type CHECK (type IN ('LIKE', 'LOVE', 'HAHA', 'ANGRY')),
    CONSTRAINT uq_forum_post_reactions_user_post UNIQUE (user_id, post_id)
);

CREATE INDEX idx_forum_post_reactions_post_type ON forum_post_reactions (post_id, type, updated_at DESC, id DESC);
