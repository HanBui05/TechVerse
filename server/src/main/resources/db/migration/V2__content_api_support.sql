-- API cần slug ổn định cho route chi tiết bài viết; dữ liệu cũ được tạo slug từ UUID.
ALTER TABLE techverse.articles ADD COLUMN IF NOT EXISTS slug varchar(280);
UPDATE techverse.articles SET slug = 'article-' || id::text WHERE slug IS NULL;
ALTER TABLE techverse.articles ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_articles_slug ON techverse.articles(slug);
