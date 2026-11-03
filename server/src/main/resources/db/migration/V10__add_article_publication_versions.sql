-- Article flow: separate the author's working copy from immutable approved snapshots.
-- No backfill (D-022): the dev database must be reset before this runs; existing rows abort it.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM articles) THEN
        RAISE EXCEPTION 'V10 requires an empty articles table: reset the techverse schema and Redis (docs/RUNBOOK.md, D-022)';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reject_article_audit_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

-- ---------------------------------------------------------------- snapshots
CREATE TABLE article_publication_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- RESTRICT: an article that was ever published can only be soft-deleted.
    article_id uuid NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
    version_number integer NOT NULL,
    title varchar(255) NOT NULL,
    summary varchar(500) NOT NULL,
    content text NOT NULL,
    cover_image_url text,
    -- Only the taxonomy ID is frozen; names resolve against current taxonomy.
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    content_fingerprint varchar(64) NOT NULL,
    reading_minutes integer NOT NULL,
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_article_publication_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_article_publication_versions_reading CHECK (reading_minutes >= 1),
    CONSTRAINT ck_article_publication_versions_fingerprint CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT uq_article_publication_versions_number UNIQUE (article_id, version_number),
    -- Target of the composite FKs below: a pointer can only reference its own article's snapshot.
    CONSTRAINT uq_article_publication_versions_article UNIQUE (id, article_id)
);

CREATE TABLE article_publication_version_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES article_publication_versions(id) ON DELETE RESTRICT,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_article_publication_version_tags UNIQUE (version_id, tag_id)
);

CREATE INDEX idx_article_publication_version_tags_tag ON article_publication_version_tags (tag_id, version_id);

CREATE TRIGGER trg_article_publication_versions_append_only
    BEFORE UPDATE OR DELETE ON article_publication_versions
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();
CREATE TRIGGER trg_article_publication_version_tags_append_only
    BEFORE UPDATE OR DELETE ON article_publication_version_tags
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();

-- ---------------------------------------------------------------- articles: two state axes
ALTER TABLE articles DROP CONSTRAINT ck_articles_status;
ALTER TABLE articles DROP CONSTRAINT ck_articles_published_at;
DROP INDEX idx_articles_topic_status;
ALTER TABLE articles DROP COLUMN status;

ALTER TABLE articles
    ADD COLUMN workflow_status varchar(30) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN publication_status varchar(30) NOT NULL DEFAULT 'UNPUBLISHED',
    ADD COLUMN hidden_from_publication_status varchar(30),
    ADD COLUMN published_version_id uuid,
    ADD COLUMN content_fingerprint varchar(64) NOT NULL,
    ADD CONSTRAINT ck_articles_workflow_status
        CHECK (workflow_status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED')),
    ADD CONSTRAINT ck_articles_publication_status
        CHECK (publication_status IN ('UNPUBLISHED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'AUTHOR_DELETED', 'REMOVED')),
    -- Every state except UNPUBLISHED points at a snapshot; the first approval also sets published_at.
    ADD CONSTRAINT ck_articles_publication_snapshot
        CHECK ((publication_status = 'UNPUBLISHED') = (published_version_id IS NULL)),
    ADD CONSTRAINT ck_articles_published_at
        CHECK ((published_version_id IS NULL) = (published_at IS NULL)),
    ADD CONSTRAINT ck_articles_workflow_snapshot
        CHECK (workflow_status <> 'PUBLISHED' OR published_version_id IS NOT NULL),
    ADD CONSTRAINT ck_articles_fingerprint CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT ck_articles_hidden_source
        CHECK ((publication_status = 'HIDDEN') = (hidden_from_publication_status IS NOT NULL)
            AND (hidden_from_publication_status IS NULL
                OR hidden_from_publication_status IN ('PUBLISHED', 'AUTHOR_HIDDEN'))),
    ADD CONSTRAINT fk_articles_published_version
        FOREIGN KEY (published_version_id, id)
        REFERENCES article_publication_versions (id, article_id) ON DELETE RESTRICT;

CREATE INDEX idx_articles_queue ON articles (workflow_status, publication_status, updated_at DESC);
CREATE INDEX idx_articles_public ON articles (publication_status, published_at DESC, id);
CREATE INDEX idx_articles_topic ON articles (topic_id);

-- ---------------------------------------------------------------- history
CREATE TABLE article_moderation_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- CASCADE only matters for hard-deleting a never-published article (its review notes go with it).
    article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(30) NOT NULL,
    note text,
    from_workflow_status varchar(30) NOT NULL,
    to_workflow_status varchar(30) NOT NULL,
    from_publication_status varchar(30) NOT NULL,
    to_publication_status varchar(30) NOT NULL,
    version_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_article_moderation_history_action CHECK (action IN (
        'APPROVE', 'REQUEST_CHANGES', 'HIDE', 'RESTORE', 'REMOVE',
        'AUTHOR_HIDE', 'AUTHOR_UNHIDE', 'AUTHOR_DELETE')),
    CONSTRAINT fk_article_moderation_history_version
        FOREIGN KEY (version_id, article_id)
        REFERENCES article_publication_versions (id, article_id) ON DELETE RESTRICT
);

CREATE INDEX idx_article_moderation_history_article
    ON article_moderation_history (article_id, created_at DESC, id DESC);

-- UPDATE only: DELETE must stay possible for the hard-delete cascade above.
CREATE TRIGGER trg_article_moderation_history_append_only
    BEFORE UPDATE ON article_moderation_history
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();

-- ---------------------------------------------------------------- saved list read path
CREATE INDEX idx_saved_articles_user_created ON saved_articles (user_id, created_at DESC, id DESC);
