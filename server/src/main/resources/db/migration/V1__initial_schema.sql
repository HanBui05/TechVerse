-- TechVerse core database schema
-- Target: PostgreSQL 16+ | Run this script against a new local database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS techverse;
SET search_path TO techverse, public;

-- ================================================================
-- 1. Authentication, users and roles
-- ================================================================

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name varchar(150) NOT NULL,
    email citext NOT NULL UNIQUE,
    password varchar(255),
    phone_number varchar(20),
    date_of_birth date,
    avatar_url text,
    is_active boolean NOT NULL DEFAULT true,
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid,
    CONSTRAINT ck_users_full_name_not_blank CHECK (btrim(full_name) <> ''),
    CONSTRAINT ck_users_email_not_blank CHECK (btrim(email::text) <> '')
);

ALTER TABLE users
    ADD CONSTRAINT fk_users_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_users_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(20) NOT NULL UNIQUE,
    description varchar(500),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_roles_name CHECK (name IN ('LEARNER', 'AUTHOR', 'MODERATOR', 'ADMIN'))
);

CREATE TABLE user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_id)
);

INSERT INTO roles (name, description)
VALUES
    ('LEARNER', 'Người học mặc định của hệ thống.'),
    ('AUTHOR', 'Người được phép tạo nội dung sau khi hồ sơ tác giả được duyệt.'),
    ('MODERATOR', 'Người kiểm duyệt nội dung và xử lý báo cáo.'),
    ('ADMIN', 'Quản trị viên có toàn quyền quản trị hệ thống.')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE social_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider varchar(20) NOT NULL,
    provider_id varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_social_accounts_provider CHECK (provider IN ('GOOGLE', 'GITHUB')),
    CONSTRAINT uq_social_accounts_provider_identity UNIQUE (provider, provider_id),
    CONSTRAINT uq_social_accounts_user_provider UNIQUE (user_id, provider)
);

CREATE TABLE author_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio text NOT NULL,
    expertise varchar(255) NOT NULL,
    portfolio_url text,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    review_note text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_author_profiles_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'))
);

-- ================================================================
-- 2. Knowledge taxonomy and content
-- ================================================================

CREATE TABLE topics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name citext NOT NULL UNIQUE,
    description varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_topics_name_not_blank CHECK (btrim(name::text) <> '')
);

CREATE TABLE tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name citext NOT NULL UNIQUE,
    description varchar(500),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_tags_name_not_blank CHECK (btrim(name::text) <> '')
);

CREATE TABLE articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    title varchar(255) NOT NULL,
    summary varchar(500) NOT NULL,
    content text NOT NULL,
    cover_image_url text,
    status varchar(30) NOT NULL DEFAULT 'DRAFT',
    moderation_note text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_articles_status
        CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'REMOVED')),
    CONSTRAINT ck_articles_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT ck_articles_published_at CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);

CREATE TABLE article_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_article_tags_article_tag UNIQUE (article_id, tag_id)
);

CREATE TABLE saved_articles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_saved_articles_user_article UNIQUE (user_id, article_id)
);

CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title varchar(255) NOT NULL,
    summary varchar(500) NOT NULL,
    source_type varchar(20) NOT NULL,
    resource_url text NOT NULL,
    file_size_bytes bigint,
    cover_image_url text,
    source_note text NOT NULL,
    status varchar(30) NOT NULL DEFAULT 'DRAFT',
    moderation_note text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_documents_source_type CHECK (source_type IN ('PDF', 'NOTION')),
    CONSTRAINT ck_documents_status
        CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'REMOVED')),
    CONSTRAINT ck_documents_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT ck_documents_resource_url_not_blank CHECK (btrim(resource_url) <> ''),
    CONSTRAINT ck_documents_file_size_by_source CHECK (
        (source_type = 'PDF' AND file_size_bytes BETWEEN 1 AND 20971520)
        OR (source_type = 'NOTION' AND file_size_bytes IS NULL)
    ),
    CONSTRAINT ck_documents_published_at CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);

CREATE TABLE saved_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_saved_documents_user_document UNIQUE (user_id, document_id)
);

-- ================================================================
-- 3. Courses, lessons and access rights
-- ================================================================

CREATE TABLE courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    title varchar(255) NOT NULL,
    summary varchar(500) NOT NULL,
    description text NOT NULL,
    level varchar(20) NOT NULL,
    price_amount bigint NOT NULL DEFAULT 0,
    currency char(3) NOT NULL DEFAULT 'VND',
    cover_image_url text,
    status varchar(30) NOT NULL DEFAULT 'DRAFT',
    moderation_note text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_courses_level CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    CONSTRAINT ck_courses_price_non_negative CHECK (price_amount >= 0),
    CONSTRAINT ck_courses_currency CHECK (currency = 'VND'),
    CONSTRAINT ck_courses_status
        CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'REMOVED')),
    CONSTRAINT ck_courses_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT ck_courses_published_at CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);

CREATE TABLE lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    content text NOT NULL,
    video_url text,
    position integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_lessons_position_positive CHECK (position > 0),
    CONSTRAINT ck_lessons_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT uq_lessons_course_position UNIQUE (course_id, position)
);

-- ================================================================
-- 4. Payment and author revenue
-- ================================================================

CREATE TABLE commission_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_bps integer NOT NULL,
    effective_from timestamptz NOT NULL DEFAULT now(),
    effective_to timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_commission_policies_rate_bps CHECK (rate_bps BETWEEN 0 AND 10000),
    CONSTRAINT ck_commission_policies_effective_range
        CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX uq_active_commission_policy
    ON commission_policies (is_active)
    WHERE is_active;

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_code varchar(50) NOT NULL UNIQUE,
    total_amount bigint NOT NULL DEFAULT 0,
    currency char(3) NOT NULL DEFAULT 'VND',
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    paid_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_orders_total_non_negative CHECK (total_amount >= 0),
    CONSTRAINT ck_orders_currency CHECK (currency = 'VND'),
    CONSTRAINT ck_orders_status CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT ck_orders_paid_at CHECK (status <> 'PAID' OR paid_at IS NOT NULL),
    CONSTRAINT ck_orders_code_not_blank CHECK (btrim(order_code) <> '')
);

CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    course_title_snapshot varchar(255) NOT NULL,
    unit_price_amount bigint NOT NULL,
    commission_policy_id uuid NOT NULL REFERENCES commission_policies(id) ON DELETE RESTRICT,
    commission_rate_bps integer NOT NULL,
    commission_amount bigint NOT NULL,
    author_net_amount bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_order_items_unit_price_non_negative CHECK (unit_price_amount >= 0),
    CONSTRAINT ck_order_items_rate_bps CHECK (commission_rate_bps BETWEEN 0 AND 10000),
    CONSTRAINT ck_order_items_commission_non_negative CHECK (commission_amount >= 0),
    CONSTRAINT ck_order_items_author_net_non_negative CHECK (author_net_amount >= 0),
    CONSTRAINT ck_order_items_revenue_sum
        CHECK (commission_amount + author_net_amount = unit_price_amount),
    CONSTRAINT uq_order_items_order_course UNIQUE (order_id, course_id)
);

CREATE TABLE payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    provider varchar(30) NOT NULL,
    provider_transaction_id varchar(255),
    amount bigint NOT NULL,
    currency char(3) NOT NULL DEFAULT 'VND',
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    requested_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    failure_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_payment_transactions_amount_non_negative CHECK (amount >= 0),
    CONSTRAINT ck_payment_transactions_currency CHECK (currency = 'VND'),
    CONSTRAINT ck_payment_transactions_status
        CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT ck_payment_transactions_paid_at CHECK (status <> 'SUCCEEDED' OR paid_at IS NOT NULL)
);

CREATE UNIQUE INDEX uq_payment_transactions_provider_reference
    ON payment_transactions (provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;

CREATE TABLE course_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    source varchar(20) NOT NULL,
    order_item_id uuid UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
    granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    revoked_at timestamptz,
    revoke_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_course_enrollments_source CHECK (source IN ('FREE', 'ADMIN_GRANT', 'PURCHASE')),
    CONSTRAINT ck_course_enrollments_source_links CHECK (
        (source = 'PURCHASE' AND order_item_id IS NOT NULL AND granted_by IS NULL)
        OR (source = 'ADMIN_GRANT' AND order_item_id IS NULL AND granted_by IS NOT NULL)
        OR (source = 'FREE' AND order_item_id IS NULL AND granted_by IS NULL)
    ),
    CONSTRAINT ck_course_enrollments_revoked_at CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE UNIQUE INDEX uq_active_course_enrollment
    ON course_enrollments (user_id, course_id)
    WHERE revoked_at IS NULL;

CREATE TABLE lesson_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_lesson_progress_user_lesson UNIQUE (user_id, lesson_id)
);

CREATE TABLE refunds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_transaction_id uuid NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
    order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
    refund_code varchar(50) NOT NULL UNIQUE,
    amount bigint NOT NULL,
    reason text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'REQUESTED',
    processed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    processed_at timestamptz,
    provider_ref varchar(255),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_refunds_amount_positive CHECK (amount > 0),
    CONSTRAINT ck_refunds_status CHECK (status IN ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
    CONSTRAINT ck_refunds_processed_at CHECK (status <> 'SUCCEEDED' OR processed_at IS NOT NULL),
    CONSTRAINT ck_refunds_code_not_blank CHECK (btrim(refund_code) <> '')
);

-- ================================================================
-- 5. Exercises and interview practice
-- ================================================================

CREATE TABLE exercise_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    title varchar(255) NOT NULL,
    description text NOT NULL,
    exercise_type varchar(30) NOT NULL,
    difficulty varchar(20) NOT NULL,
    time_limit_seconds integer,
    status varchar(30) NOT NULL DEFAULT 'DRAFT',
    moderation_note text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_exercise_sets_type
        CHECK (exercise_type IN ('MULTIPLE_CHOICE', 'FLASHCARD', 'CODE_BUG_FINDING', 'DEBUG_SCENARIO')),
    CONSTRAINT ck_exercise_sets_difficulty CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
    CONSTRAINT ck_exercise_sets_time_limit CHECK (time_limit_seconds IS NULL OR time_limit_seconds > 0),
    CONSTRAINT ck_exercise_sets_status
        CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'REMOVED')),
    CONSTRAINT ck_exercise_sets_published_at
        CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
    CONSTRAINT ck_exercise_sets_title_not_blank CHECK (btrim(title) <> '')
);

CREATE TABLE exercise_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_set_id uuid NOT NULL REFERENCES exercise_sets(id) ON DELETE RESTRICT,
    content text NOT NULL,
    code_snippet text,
    code_language varchar(50),
    options jsonb,
    answer text NOT NULL,
    explanation text NOT NULL,
    position integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_exercise_questions_position_positive CHECK (position > 0),
    CONSTRAINT ck_exercise_questions_options_array
        CHECK (options IS NULL OR jsonb_typeof(options) = 'array'),
    CONSTRAINT ck_exercise_questions_answer_not_blank CHECK (btrim(answer) <> ''),
    CONSTRAINT uq_exercise_questions_set_position UNIQUE (exercise_set_id, position)
);

CREATE TABLE exercise_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    exercise_set_id uuid NOT NULL REFERENCES exercise_sets(id) ON DELETE RESTRICT,
    attempt_snapshot jsonb NOT NULL,
    correct_count integer,
    total_count integer,
    duration_seconds integer NOT NULL DEFAULT 0,
    completed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_exercise_attempts_snapshot_object CHECK (jsonb_typeof(attempt_snapshot) = 'object'),
    CONSTRAINT ck_exercise_attempts_counts CHECK (
        (correct_count IS NULL AND total_count IS NULL)
        OR (correct_count IS NOT NULL AND total_count IS NOT NULL
            AND correct_count >= 0 AND total_count >= 0 AND correct_count <= total_count)
    ),
    CONSTRAINT ck_exercise_attempts_duration_non_negative CHECK (duration_seconds >= 0)
);

CREATE TABLE interview_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    level varchar(20) NOT NULL,
    question text NOT NULL,
    sample_answer text NOT NULL,
    hint text,
    status varchar(30) NOT NULL DEFAULT 'DRAFT',
    moderation_note text,
    reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_interview_questions_level CHECK (level IN ('EASY', 'MEDIUM', 'HARD')),
    CONSTRAINT ck_interview_questions_status
        CHECK (status IN ('DRAFT', 'PENDING', 'PUBLISHED', 'CHANGES_REQUESTED', 'HIDDEN', 'REMOVED')),
    CONSTRAINT ck_interview_questions_published_at
        CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
    CONSTRAINT ck_interview_questions_question_not_blank CHECK (btrim(question) <> '')
);

-- ================================================================
-- 6. Community and moderation
-- ================================================================

CREATE TABLE forum_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    parent_id uuid REFERENCES forum_posts(id) ON DELETE RESTRICT,
    title varchar(255),
    content text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'VISIBLE',
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_forum_posts_status CHECK (status IN ('VISIBLE', 'HIDDEN', 'DELETED')),
    CONSTRAINT ck_forum_posts_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT ck_forum_posts_question_or_answer CHECK (
        (parent_id IS NULL AND title IS NOT NULL AND btrim(title) <> '')
        OR (parent_id IS NOT NULL AND title IS NULL)
    ),
    CONSTRAINT ck_forum_posts_content_not_blank CHECK (btrim(content) <> '')
);

CREATE TABLE comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_type varchar(20) NOT NULL,
    target_id uuid NOT NULL,
    parent_id uuid REFERENCES comments(id) ON DELETE RESTRICT,
    content text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'VISIBLE',
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_comments_target_type CHECK (target_type IN ('ARTICLE', 'DOCUMENT', 'COURSE')),
    CONSTRAINT ck_comments_status CHECK (status IN ('VISIBLE', 'HIDDEN', 'DELETED')),
    CONSTRAINT ck_comments_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT ck_comments_content_not_blank CHECK (btrim(content) <> '')
);

CREATE TABLE reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    target_type varchar(20) NOT NULL,
    target_id uuid NOT NULL,
    reason varchar(20) NOT NULL,
    description text,
    status varchar(20) NOT NULL DEFAULT 'OPEN',
    handled_by uuid REFERENCES users(id) ON DELETE SET NULL,
    handled_at timestamptz,
    resolution_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT ck_reports_target_type CHECK (target_type IN ('ARTICLE', 'DOCUMENT', 'COURSE', 'COMMENT', 'FORUM_POST')),
    CONSTRAINT ck_reports_reason CHECK (reason IN ('SPAM', 'INAPPROPRIATE', 'COPYRIGHT', 'MISLEADING', 'OTHER')),
    CONSTRAINT ck_reports_status CHECK (status IN ('OPEN', 'ACTIONED', 'DISMISSED')),
    CONSTRAINT uq_reports_reporter_target UNIQUE (reporter_id, target_type, target_id)
);

-- ================================================================
-- 7. Integrity functions and triggers
-- ================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION assign_default_learner_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO user_roles (user_id, role_id)
    SELECT NEW.id, id
    FROM roles
    WHERE name = 'LEARNER'
    ON CONFLICT (user_id, role_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_assign_default_learner_role
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION assign_default_learner_role();

CREATE OR REPLACE FUNCTION calculate_order_item_revenue()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    policy_rate integer;
BEGIN
    SELECT rate_bps
      INTO policy_rate
      FROM commission_policies
     WHERE id = NEW.commission_policy_id;

    IF policy_rate IS NULL THEN
        RAISE EXCEPTION 'Commission policy % does not exist', NEW.commission_policy_id;
    END IF;

    NEW.commission_rate_bps := policy_rate;
    NEW.commission_amount := floor(
        (NEW.unit_price_amount::numeric * NEW.commission_rate_bps) / 10000
    )::bigint;
    NEW.author_net_amount := NEW.unit_price_amount - NEW.commission_amount;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_items_calculate_revenue
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION calculate_order_item_revenue();

CREATE OR REPLACE FUNCTION enforce_order_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    expected_total bigint;
BEGIN
    SELECT COALESCE(SUM(unit_price_amount), 0)
      INTO expected_total
      FROM order_items
     WHERE order_id = NEW.id;

    IF TG_OP = 'INSERT' AND NEW.total_amount <> 0 THEN
        RAISE EXCEPTION 'A new order must start with total_amount = 0';
    END IF;

    IF TG_OP = 'UPDATE' AND pg_trigger_depth() = 1 AND NEW.total_amount <> expected_total THEN
        RAISE EXCEPTION 'orders.total_amount (%) must equal item total (%)', NEW.total_amount, expected_total;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_enforce_total
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION enforce_order_total();

CREATE OR REPLACE FUNCTION refresh_order_total()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_order_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_order_id := OLD.order_id;
    ELSE
        target_order_id := NEW.order_id;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
        UPDATE orders
           SET total_amount = COALESCE(
               (SELECT SUM(unit_price_amount) FROM order_items WHERE order_id = OLD.order_id),
               0
           )
         WHERE id = OLD.order_id;
    END IF;

    UPDATE orders
       SET total_amount = COALESCE(
           (SELECT SUM(unit_price_amount) FROM order_items WHERE order_id = target_order_id),
           0
       )
     WHERE id = target_order_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_order_items_refresh_order_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION refresh_order_total();

CREATE OR REPLACE FUNCTION validate_payment_transaction()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    expected_amount bigint;
    expected_currency char(3);
BEGIN
    SELECT total_amount, currency
      INTO expected_amount, expected_currency
      FROM orders
     WHERE id = NEW.order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order % does not exist', NEW.order_id;
    END IF;

    IF NEW.amount <> expected_amount THEN
        RAISE EXCEPTION 'Payment amount (%) must equal order total (%)', NEW.amount, expected_amount;
    END IF;

    IF NEW.currency <> expected_currency THEN
        RAISE EXCEPTION 'Payment currency must match order currency';
    END IF;

    IF NEW.status = 'SUCCEEDED' AND NEW.paid_at IS NULL THEN
        NEW.paid_at := now();
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_transactions_validate
BEFORE INSERT OR UPDATE ON payment_transactions
FOR EACH ROW
EXECUTE FUNCTION validate_payment_transaction();

CREATE OR REPLACE FUNCTION user_has_role(p_user_id uuid, p_role_name varchar)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND r.name = p_role_name
    );
$$;

CREATE OR REPLACE FUNCTION validate_course_enrollment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    item_course_id uuid;
    order_user_id uuid;
    order_status varchar(20);
    course_price bigint;
BEGIN
    IF NEW.source = 'PURCHASE' THEN
        SELECT oi.course_id, o.user_id, o.status
          INTO item_course_id, order_user_id, order_status
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
         WHERE oi.id = NEW.order_item_id;

        IF NOT FOUND OR item_course_id <> NEW.course_id OR order_user_id <> NEW.user_id OR order_status <> 'PAID' THEN
            RAISE EXCEPTION 'PURCHASE enrollment must match a paid order item owned by the learner';
        END IF;
    ELSIF NEW.source = 'ADMIN_GRANT' THEN
        IF NOT user_has_role(NEW.granted_by, 'ADMIN') THEN
            RAISE EXCEPTION 'Only an ADMIN may create an ADMIN_GRANT enrollment';
        END IF;
    ELSIF NEW.source = 'FREE' THEN
        SELECT price_amount INTO course_price FROM courses WHERE id = NEW.course_id;
        IF NOT FOUND OR course_price <> 0 THEN
            RAISE EXCEPTION 'FREE enrollment requires a free course';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_course_enrollments_validate
BEFORE INSERT OR UPDATE ON course_enrollments
FOR EACH ROW
EXECUTE FUNCTION validate_course_enrollment();

CREATE OR REPLACE FUNCTION grant_course_access_after_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status <> 'SUCCEEDED' OR (TG_OP = 'UPDATE' AND OLD.status = 'SUCCEEDED') THEN
        RETURN NEW;
    END IF;

    UPDATE orders
       SET status = 'PAID',
           paid_at = COALESCE(NEW.paid_at, now())
     WHERE id = NEW.order_id;

    INSERT INTO course_enrollments (user_id, course_id, source, order_item_id, granted_at)
    SELECT o.user_id, oi.course_id, 'PURCHASE', oi.id, now()
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = NEW.order_id
    ON CONFLICT (order_item_id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_transactions_grant_course_access
AFTER INSERT OR UPDATE OF status ON payment_transactions
FOR EACH ROW
EXECUTE FUNCTION grant_course_access_after_payment();

CREATE OR REPLACE FUNCTION validate_lesson_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM lessons l
        JOIN course_enrollments ce ON ce.course_id = l.course_id
        WHERE l.id = NEW.lesson_id
          AND ce.user_id = NEW.user_id
          AND ce.revoked_at IS NULL
    ) THEN
        RAISE EXCEPTION 'The learner must have active course access before completing a lesson';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lesson_progress_validate_access
BEFORE INSERT OR UPDATE ON lesson_progress
FOR EACH ROW
EXECUTE FUNCTION validate_lesson_progress();

CREATE OR REPLACE FUNCTION validate_refund()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    item_price bigint;
    payment_status varchar(20);
    prior_refunded_amount bigint;
BEGIN
    SELECT oi.unit_price_amount, pt.status
      INTO item_price, payment_status
      FROM order_items oi
      JOIN payment_transactions pt ON pt.order_id = oi.order_id
     WHERE oi.id = NEW.order_item_id
       AND pt.id = NEW.payment_transaction_id;

    IF NOT FOUND OR payment_status <> 'SUCCEEDED' THEN
        RAISE EXCEPTION 'A refund must reference a successful payment for the same order item';
    END IF;

    IF NEW.status IN ('PROCESSING', 'SUCCEEDED') AND NEW.processed_by IS NULL THEN
        RAISE EXCEPTION 'A processing or successful refund must have processed_by';
    END IF;

    IF NEW.status IN ('PROCESSING', 'SUCCEEDED') AND NOT user_has_role(NEW.processed_by, 'ADMIN') THEN
        RAISE EXCEPTION 'Only an ADMIN may process a refund';
    END IF;

    IF NEW.status = 'SUCCEEDED' THEN
        SELECT COALESCE(SUM(amount), 0)
          INTO prior_refunded_amount
          FROM refunds
         WHERE order_item_id = NEW.order_item_id
           AND status = 'SUCCEEDED'
           AND id <> NEW.id;

        IF prior_refunded_amount + NEW.amount > item_price THEN
            RAISE EXCEPTION 'Successful refunds may not exceed the order item price';
        END IF;

        IF NEW.processed_at IS NULL THEN
            NEW.processed_at := now();
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refunds_validate
BEFORE INSERT OR UPDATE ON refunds
FOR EACH ROW
EXECUTE FUNCTION validate_refund();

CREATE OR REPLACE FUNCTION revoke_course_access_after_refund()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status <> 'SUCCEEDED' OR (TG_OP = 'UPDATE' AND OLD.status = 'SUCCEEDED') THEN
        RETURN NEW;
    END IF;

    UPDATE course_enrollments
       SET revoked_at = now(),
           revoked_by = NEW.processed_by,
           revoke_reason = 'Refund ' || NEW.refund_code
     WHERE order_item_id = NEW.order_item_id
       AND source = 'PURCHASE'
       AND revoked_at IS NULL;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_refunds_revoke_course_access
AFTER INSERT OR UPDATE OF status ON refunds
FOR EACH ROW
EXECUTE FUNCTION revoke_course_access_after_refund();

CREATE OR REPLACE FUNCTION prevent_exercise_set_delete_with_attempts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM exercise_attempts WHERE exercise_set_id = OLD.id) THEN
        RAISE EXCEPTION 'Exercise set % has attempts and cannot be hard-deleted', OLD.id;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_exercise_sets_prevent_delete_with_attempts
BEFORE DELETE ON exercise_sets
FOR EACH ROW
EXECUTE FUNCTION prevent_exercise_set_delete_with_attempts();

CREATE OR REPLACE FUNCTION validate_forum_post_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_parent_id uuid;
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        SELECT parent_id INTO parent_parent_id FROM forum_posts WHERE id = NEW.parent_id;
        IF NOT FOUND OR parent_parent_id IS NOT NULL THEN
            RAISE EXCEPTION 'A forum answer must reply directly to a root question';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_forum_posts_validate_hierarchy
BEFORE INSERT OR UPDATE OF parent_id, title ON forum_posts
FOR EACH ROW
EXECUTE FUNCTION validate_forum_post_hierarchy();

CREATE OR REPLACE FUNCTION validate_comment_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_exists boolean;
    parent_target_type varchar(20);
    parent_target_id uuid;
BEGIN
    CASE NEW.target_type
        WHEN 'ARTICLE' THEN SELECT EXISTS (SELECT 1 FROM articles WHERE id = NEW.target_id) INTO target_exists;
        WHEN 'DOCUMENT' THEN SELECT EXISTS (SELECT 1 FROM documents WHERE id = NEW.target_id) INTO target_exists;
        WHEN 'COURSE' THEN SELECT EXISTS (SELECT 1 FROM courses WHERE id = NEW.target_id) INTO target_exists;
    END CASE;

    IF NOT COALESCE(target_exists, false) THEN
        RAISE EXCEPTION 'Comment target does not exist';
    END IF;

    IF NEW.parent_id IS NOT NULL THEN
        SELECT target_type, target_id
          INTO parent_target_type, parent_target_id
          FROM comments
         WHERE id = NEW.parent_id;
        IF NOT FOUND OR parent_target_type <> NEW.target_type OR parent_target_id <> NEW.target_id THEN
            RAISE EXCEPTION 'A reply must use the same target as its parent comment';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comments_validate_target
BEFORE INSERT OR UPDATE OF target_type, target_id, parent_id ON comments
FOR EACH ROW
EXECUTE FUNCTION validate_comment_target();

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
    END CASE;

    IF NOT COALESCE(target_exists, false) THEN
        RAISE EXCEPTION 'Report target does not exist';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reports_validate_target
BEFORE INSERT OR UPDATE OF target_type, target_id ON reports
FOR EACH ROW
EXECUTE FUNCTION validate_report_target();

-- Add automatic updated_at handling to every table with audit columns.
DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'roles', 'user_roles', 'social_accounts', 'author_profiles',
        'topics', 'tags', 'articles', 'article_tags', 'saved_articles',
        'documents', 'saved_documents', 'courses', 'lessons', 'commission_policies',
        'orders', 'order_items', 'payment_transactions', 'course_enrollments',
        'lesson_progress', 'refunds', 'exercise_sets', 'exercise_questions',
        'exercise_attempts', 'interview_questions', 'forum_posts', 'comments', 'reports'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            'trg_' || table_name || '_set_updated_at',
            table_name
        );
    END LOOP;
END;
$$;

-- ================================================================
-- 8. Supporting indexes
-- ================================================================

CREATE INDEX idx_articles_topic_status ON articles (topic_id, status, published_at DESC);
CREATE INDEX idx_articles_author ON articles (author_id);
CREATE INDEX idx_documents_author_status ON documents (author_id, status, published_at DESC);
CREATE INDEX idx_courses_topic_status ON courses (topic_id, status, published_at DESC);
CREATE INDEX idx_courses_author ON courses (author_id);
CREATE INDEX idx_lessons_course_position ON lessons (course_id, position);
CREATE INDEX idx_orders_user_created_at ON orders (user_id, created_at DESC);
CREATE INDEX idx_order_items_course ON order_items (course_id);
CREATE INDEX idx_payment_transactions_order ON payment_transactions (order_id, status);
CREATE INDEX idx_course_enrollments_user_active ON course_enrollments (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_lesson_progress_user ON lesson_progress (user_id);
CREATE INDEX idx_refunds_order_item_status ON refunds (order_item_id, status);
CREATE INDEX idx_exercise_sets_topic_status ON exercise_sets (topic_id, status);
CREATE INDEX idx_exercise_attempts_user_completed ON exercise_attempts (user_id, completed_at DESC);
CREATE INDEX idx_interview_questions_topic_level_published
    ON interview_questions (topic_id, level)
    WHERE status = 'PUBLISHED';
CREATE INDEX idx_forum_posts_parent_created_at ON forum_posts (parent_id, created_at);
CREATE INDEX idx_comments_target ON comments (target_type, target_id, created_at);
CREATE INDEX idx_reports_status_created_at ON reports (status, created_at);

