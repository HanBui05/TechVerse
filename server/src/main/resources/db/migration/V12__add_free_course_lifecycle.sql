-- Free course: working copy + immutable approved snapshots, like article-flow (V10).
-- No backfill: the dev database must be reset before this runs; existing rows abort it.
-- Price/payment/refund objects are intentionally untouched (course-payment module).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM courses) OR EXISTS (SELECT 1 FROM lessons) THEN
        RAISE EXCEPTION 'V12 requires empty courses and lessons tables: reset the techverse schema and Redis (docs/RUNBOOK.md, D-022)';
    END IF;
END;
$$;

-- ---------------------------------------------------------------- courses: free + two state axes
ALTER TABLE courses DROP CONSTRAINT ck_courses_status;
ALTER TABLE courses DROP CONSTRAINT ck_courses_published_at;
DROP INDEX idx_courses_topic_status;
ALTER TABLE courses DROP COLUMN status;

CREATE TABLE course_publication_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- RESTRICT: a course that was ever published can only be soft-deleted.
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    version_number integer NOT NULL,
    title varchar(255) NOT NULL,
    summary varchar(500) NOT NULL,
    description text NOT NULL,
    level varchar(20) NOT NULL,
    cover_image_url text,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    -- Covers metadata, tags and curriculum, so any curriculum edit counts as an unpublished change.
    content_fingerprint varchar(64) NOT NULL,
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_course_publication_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_course_publication_versions_level CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    CONSTRAINT ck_course_publication_versions_fingerprint CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT uq_course_publication_versions_number UNIQUE (course_id, version_number),
    CONSTRAINT uq_course_publication_versions_course UNIQUE (id, course_id)
);

ALTER TABLE courses
    ADD COLUMN workflow_status varchar(30) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN publication_status varchar(30) NOT NULL DEFAULT 'UNPUBLISHED',
    ADD COLUMN hidden_from_publication_status varchar(30),
    ADD COLUMN published_version_id uuid,
    ADD COLUMN content_fingerprint varchar(64) NOT NULL,
    ADD CONSTRAINT ck_courses_free CHECK (price_amount = 0 AND currency = 'VND'),
    ADD CONSTRAINT ck_courses_workflow_status
        CHECK (workflow_status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED')),
    ADD CONSTRAINT ck_courses_publication_status
        CHECK (publication_status IN ('UNPUBLISHED', 'PUBLISHED', 'AUTHOR_HIDDEN', 'HIDDEN', 'AUTHOR_DELETED', 'REMOVED')),
    ADD CONSTRAINT ck_courses_publication_snapshot
        CHECK ((publication_status = 'UNPUBLISHED') = (published_version_id IS NULL)),
    ADD CONSTRAINT ck_courses_published_at
        CHECK ((published_version_id IS NULL) = (published_at IS NULL)),
    ADD CONSTRAINT ck_courses_workflow_snapshot
        CHECK (workflow_status <> 'PUBLISHED' OR published_version_id IS NOT NULL),
    ADD CONSTRAINT ck_courses_fingerprint CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT ck_courses_hidden_source
        CHECK ((publication_status = 'HIDDEN') = (hidden_from_publication_status IS NOT NULL)
            AND (hidden_from_publication_status IS NULL
                OR hidden_from_publication_status IN ('PUBLISHED', 'AUTHOR_HIDDEN'))),
    ADD CONSTRAINT fk_courses_published_version
        FOREIGN KEY (published_version_id, id)
        REFERENCES course_publication_versions (id, course_id) ON DELETE RESTRICT;

CREATE INDEX idx_courses_queue ON courses (workflow_status, publication_status, updated_at DESC);
CREATE INDEX idx_courses_public ON courses (publication_status, published_at DESC, id);
CREATE INDEX idx_courses_topic ON courses (topic_id);

-- ---------------------------------------------------------------- working copy: tags, chapters, lessons
CREATE TABLE course_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_course_tags_course_tag UNIQUE (course_id, tag_id)
);
CREATE INDEX idx_course_tags_tag ON course_tags (tag_id);

CREATE TABLE course_chapters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    position integer NOT NULL,
    -- Archived once a snapshot referenced it: the ID (and learner progress) must survive.
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_course_chapters_position CHECK (position > 0),
    CONSTRAINT ck_course_chapters_title CHECK (btrim(title) <> ''),
    CONSTRAINT uq_course_chapters_course UNIQUE (id, course_id)
);
-- Partial: archived rows keep their position without blocking reuse. Not deferrable, so reorders
-- must move rows through free positions.
CREATE UNIQUE INDEX uq_course_chapters_active_position
    ON course_chapters (course_id, position) WHERE archived_at IS NULL;

DROP INDEX idx_lessons_course_position;
ALTER TABLE lessons DROP CONSTRAINT uq_lessons_course_position;
ALTER TABLE lessons DROP COLUMN video_url;
ALTER TABLE lessons ALTER COLUMN content DROP NOT NULL;
ALTER TABLE lessons
    ADD COLUMN chapter_id uuid NOT NULL,
    ADD COLUMN summary varchar(500),
    ADD COLUMN video_provider varchar(20),
    ADD COLUMN video_id varchar(11),
    ADD COLUMN is_preview boolean NOT NULL DEFAULT false,
    ADD COLUMN content_fingerprint varchar(64) NOT NULL,
    ADD COLUMN ai_assisted boolean NOT NULL DEFAULT false,
    ADD COLUMN archived_at timestamptz,
    -- A lesson can only sit in a chapter of its own course.
    ADD CONSTRAINT fk_lessons_chapter FOREIGN KEY (chapter_id, course_id)
        REFERENCES course_chapters (id, course_id) ON DELETE CASCADE,
    ADD CONSTRAINT ck_lessons_content_or_video
        CHECK ((content IS NOT NULL AND btrim(content) <> '') OR video_id IS NOT NULL),
    ADD CONSTRAINT ck_lessons_video
        CHECK ((video_provider IS NULL) = (video_id IS NULL)
            AND (video_provider IS NULL
                OR (video_provider = 'YOUTUBE' AND video_id ~ '^[A-Za-z0-9_-]{11}$'))),
    ADD CONSTRAINT ck_lessons_fingerprint CHECK (content_fingerprint ~ '^[a-f0-9]{64}$');
CREATE UNIQUE INDEX uq_lessons_active_position ON lessons (chapter_id, position) WHERE archived_at IS NULL;
CREATE INDEX idx_lessons_course_chapter ON lessons (course_id, chapter_id, position);

-- ---------------------------------------------------------------- snapshot children
CREATE TABLE course_publication_version_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES course_publication_versions(id) ON DELETE RESTRICT,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_course_publication_version_tags UNIQUE (version_id, tag_id)
);
CREATE INDEX idx_course_publication_version_tags_tag ON course_publication_version_tags (tag_id, version_id);

CREATE TABLE course_publication_version_chapters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES course_publication_versions(id) ON DELETE RESTRICT,
    chapter_id uuid NOT NULL REFERENCES course_chapters(id) ON DELETE RESTRICT,
    title varchar(255) NOT NULL,
    position integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_course_publication_version_chapters_position CHECK (position > 0),
    CONSTRAINT uq_course_publication_version_chapters_chapter UNIQUE (version_id, chapter_id),
    CONSTRAINT uq_course_publication_version_chapters_position UNIQUE (version_id, position),
    CONSTRAINT uq_course_publication_version_chapters_version UNIQUE (id, version_id)
);

CREATE TABLE course_publication_version_lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id uuid NOT NULL REFERENCES course_publication_versions(id) ON DELETE RESTRICT,
    version_chapter_id uuid NOT NULL,
    -- Stable ID: progress, "continue learning" and later RAG all point at lessons.id.
    lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
    title varchar(255) NOT NULL,
    summary varchar(500),
    content text,
    video_provider varchar(20),
    video_id varchar(11),
    is_preview boolean NOT NULL,
    position integer NOT NULL,
    content_fingerprint varchar(64) NOT NULL,
    ai_assisted boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_course_publication_version_lessons_chapter FOREIGN KEY (version_chapter_id, version_id)
        REFERENCES course_publication_version_chapters (id, version_id) ON DELETE RESTRICT,
    CONSTRAINT ck_course_publication_version_lessons_position CHECK (position > 0),
    CONSTRAINT ck_course_publication_version_lessons_content_or_video
        CHECK ((content IS NOT NULL AND btrim(content) <> '') OR video_id IS NOT NULL),
    CONSTRAINT ck_course_publication_version_lessons_video
        CHECK ((video_provider IS NULL) = (video_id IS NULL)
            AND (video_provider IS NULL
                OR (video_provider = 'YOUTUBE' AND video_id ~ '^[A-Za-z0-9_-]{11}$'))),
    CONSTRAINT ck_course_publication_version_lessons_fingerprint CHECK (content_fingerprint ~ '^[a-f0-9]{64}$'),
    CONSTRAINT uq_course_publication_version_lessons_lesson UNIQUE (version_id, lesson_id),
    CONSTRAINT uq_course_publication_version_lessons_position UNIQUE (version_chapter_id, position)
);
CREATE INDEX idx_course_publication_version_lessons_lesson ON course_publication_version_lessons (lesson_id);

CREATE TRIGGER trg_course_publication_versions_append_only
    BEFORE UPDATE OR DELETE ON course_publication_versions
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();
CREATE TRIGGER trg_course_publication_version_tags_append_only
    BEFORE UPDATE OR DELETE ON course_publication_version_tags
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();
CREATE TRIGGER trg_course_publication_version_chapters_append_only
    BEFORE UPDATE OR DELETE ON course_publication_version_chapters
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();
CREATE TRIGGER trg_course_publication_version_lessons_append_only
    BEFORE UPDATE OR DELETE ON course_publication_version_lessons
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();

CREATE TRIGGER trg_course_tags_set_updated_at
    BEFORE UPDATE ON course_tags FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_course_chapters_set_updated_at
    BEFORE UPDATE ON course_chapters FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------- history
CREATE TABLE course_moderation_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- CASCADE only matters for hard-deleting a never-published course.
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
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
    CONSTRAINT ck_course_moderation_history_action CHECK (action IN (
        'APPROVE', 'REQUEST_CHANGES', 'HIDE', 'RESTORE', 'REMOVE',
        'AUTHOR_HIDE', 'AUTHOR_UNHIDE', 'AUTHOR_DELETE')),
    CONSTRAINT fk_course_moderation_history_version
        FOREIGN KEY (version_id, course_id)
        REFERENCES course_publication_versions (id, course_id) ON DELETE RESTRICT
);
CREATE INDEX idx_course_moderation_history_course
    ON course_moderation_history (course_id, created_at DESC, id DESC);
CREATE TRIGGER trg_course_moderation_history_append_only
    BEFORE UPDATE ON course_moderation_history
    FOR EACH ROW EXECUTE FUNCTION reject_article_audit_change();

-- ---------------------------------------------------------------- continue learning
ALTER TABLE course_enrollments
    ADD COLUMN last_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
    ADD COLUMN last_accessed_at timestamptz,
    ADD CONSTRAINT ck_course_enrollments_last_access
        CHECK (last_lesson_id IS NULL OR last_accessed_at IS NOT NULL);
CREATE INDEX idx_course_enrollments_last_lesson
    ON course_enrollments (last_lesson_id) WHERE last_lesson_id IS NOT NULL;
