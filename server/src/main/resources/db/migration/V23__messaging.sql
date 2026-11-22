-- Private messaging between a learner and a course author: one conversation per (learner, author) pair.
-- Messages are ordered by a database-issued seq (gaps allowed), used as page cursor and read marker.
CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    context_course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
    context_course_title varchar(255) NOT NULL,
    author_replied boolean NOT NULL DEFAULT false,
    last_message_seq bigint,
    last_message_at timestamptz,
    last_message_sender_id uuid REFERENCES users(id) ON DELETE RESTRICT,
    learner_last_read_seq bigint NOT NULL DEFAULT 0,
    author_last_read_seq bigint NOT NULL DEFAULT 0,
    blocked_by uuid REFERENCES users(id) ON DELETE RESTRICT,
    blocked_at timestamptz,
    locked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    locked_at timestamptz,
    lock_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_conversations_pair UNIQUE (learner_id, author_id),
    CONSTRAINT ck_conversations_participants CHECK (learner_id <> author_id),
    CONSTRAINT ck_conversations_blocked CHECK ((blocked_by IS NULL) = (blocked_at IS NULL)),
    CONSTRAINT ck_conversations_last_message
        CHECK ((last_message_seq IS NULL) = (last_message_at IS NULL) AND (last_message_seq IS NULL) = (last_message_sender_id IS NULL))
);

CREATE INDEX idx_conversations_learner_last ON conversations (learner_id, last_message_at DESC);
CREATE INDEX idx_conversations_author_last ON conversations (author_id, last_message_at DESC);

CREATE TRIGGER trg_conversations_set_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
    sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content text NOT NULL,
    client_id uuid NOT NULL,
    seq bigint GENERATED ALWAYS AS IDENTITY,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_messages_content CHECK (btrim(content) <> ''),
    -- Per sender, not per conversation: a resent client id is either the same message or refused.
    CONSTRAINT uq_messages_sender_client UNIQUE (sender_id, client_id)
);

CREATE UNIQUE INDEX uq_messages_conversation_seq ON messages (conversation_id, seq);

-- Reports may target a conversation (handled in the reports flow); earlier branches unchanged.
ALTER TABLE reports DROP CONSTRAINT ck_reports_target_type;
ALTER TABLE reports ADD CONSTRAINT ck_reports_target_type
    CHECK (target_type IN ('ARTICLE', 'DOCUMENT', 'COURSE', 'COMMENT', 'FORUM_POST', 'CONVERSATION'));

CREATE OR REPLACE FUNCTION validate_report_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_exists boolean;
BEGIN
    CASE NEW.target_type
        WHEN 'ARTICLE' THEN SELECT EXISTS (SELECT 1 FROM articles WHERE id = NEW.target_id) INTO target_exists;
        WHEN 'DOCUMENT' THEN SELECT EXISTS (SELECT 1 FROM documents WHERE id = NEW.target_id) INTO target_exists;
        WHEN 'COURSE' THEN SELECT EXISTS (SELECT 1 FROM courses WHERE id = NEW.target_id) INTO target_exists;
        WHEN 'COMMENT' THEN SELECT EXISTS (SELECT 1 FROM comments WHERE id = NEW.target_id) INTO target_exists;
        WHEN 'FORUM_POST' THEN SELECT EXISTS (SELECT 1 FROM forum_posts WHERE id = NEW.target_id) INTO target_exists;
        WHEN 'CONVERSATION' THEN SELECT EXISTS (SELECT 1 FROM conversations WHERE id = NEW.target_id) INTO target_exists;
    END CASE;

    IF NOT COALESCE(target_exists, false) THEN
        RAISE EXCEPTION 'Report target does not exist';
    END IF;
    RETURN NEW;
END;
$$;
