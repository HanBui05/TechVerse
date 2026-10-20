-- Dữ liệu demo cho môi trường local/review. Không dùng migration này cho production.
-- Tài khoản demo: demo@techverse.local / password

INSERT INTO techverse.users (id, full_name, email, password, email_verified_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'Nguyễn Minh Demo', 'demo@techverse.local',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', now())
ON CONFLICT (email) DO NOTHING;

INSERT INTO techverse.user_roles (id, user_id, role_id)
SELECT '00000000-0000-0000-0000-000000000011',
       '00000000-0000-0000-0000-000000000001', r.id
FROM techverse.roles r WHERE r.name = 'AUTHOR'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO techverse.topics (id, name, description)
VALUES
 ('00000000-0000-0000-0000-000000000101', 'Lập trình Web', 'Frontend, backend và kiến trúc ứng dụng web.'),
 ('00000000-0000-0000-0000-000000000102', 'Cơ sở dữ liệu', 'SQL, thiết kế dữ liệu và tối ưu truy vấn.'),
 ('00000000-0000-0000-0000-000000000103', 'DevOps', 'Container, CI/CD và vận hành hệ thống.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO techverse.tags (id, name, description)
VALUES
 ('00000000-0000-0000-0000-000000000201', 'Spring Boot', 'Java backend framework'),
 ('00000000-0000-0000-0000-000000000202', 'PostgreSQL', 'Hệ quản trị cơ sở dữ liệu quan hệ'),
 ('00000000-0000-0000-0000-000000000203', 'Docker', 'Đóng gói và chạy ứng dụng bằng container')
ON CONFLICT (name) DO NOTHING;

INSERT INTO techverse.articles
 (id, author_id, topic_id, title, slug, summary, content, status, published_at)
VALUES
 ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101',
  'Xây dựng REST API với Spring Boot', 'xay-dung-rest-api-voi-spring-boot',
  'Các nguyên tắc cơ bản để tổ chức một REST API dễ bảo trì.',
  '# REST API với Spring Boot\n\nMột API tốt nên tách controller, service và persistence layer. Hãy bắt đầu bằng contract rõ ràng, validation và mã lỗi nhất quán.',
  'PUBLISHED', now()),
 ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102',
  'Thiết kế bảng PostgreSQL hiệu quả', 'thiet-ke-bang-postgresql-hieu-qua',
  'Checklist ngắn để thiết kế schema, khóa và index phù hợp.',
  '# Thiết kế PostgreSQL\n\nBắt đầu từ nghiệp vụ, chọn kiểu dữ liệu đúng, khai báo khóa ngoại và chỉ tạo index phục vụ truy vấn thực tế.',
  'PUBLISHED', now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO techverse.article_tags (id, article_id, tag_id)
VALUES
 ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201'),
 ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000202')
ON CONFLICT (article_id, tag_id) DO NOTHING;

INSERT INTO techverse.documents
 (id, author_id, title, summary, source_type, resource_url, file_size_bytes, source_note, status, published_at)
VALUES
 ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001',
  'PostgreSQL SQL Cookbook', 'Tài liệu tham khảo nhanh cho các truy vấn SQL phổ biến.', 'PDF',
  'https://www.postgresql.org/docs/current/', 1024, 'PostgreSQL Documentation', 'PUBLISHED', now()),
 ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001',
  'Docker Get Started', 'Hướng dẫn chính thức để làm quen với Docker.', 'NOTION',
  'https://www.notion.so/techverse-demo-docker', NULL, 'TechVerse demo resource', 'PUBLISHED', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO techverse.courses
 (id, author_id, topic_id, title, summary, description, level, price_amount, currency, status, published_at)
VALUES
 ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101',
  'Backend Java thực chiến', 'Xây dựng API backend có database và validation.',
  'Khóa học demo giúp người học nắm luồng từ thiết kế endpoint đến kết nối PostgreSQL.',
  'BEGINNER', 0, 'VND', 'PUBLISHED', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO techverse.lessons (id, course_id, title, content, position)
VALUES
 ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000501', 'Thiết kế endpoint', 'Xác định resource, HTTP method và response contract.', 1),
 ('00000000-0000-0000-0000-000000000512', '00000000-0000-0000-0000-000000000501', 'Kết nối PostgreSQL', 'Dùng migration và repository để lưu dữ liệu an toàn.', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO techverse.exercise_sets
 (id, author_id, topic_id, title, description, exercise_type, difficulty, status, published_at)
VALUES
 ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101',
  'REST API cơ bản', 'Kiểm tra kiến thức nền tảng về HTTP và REST.', 'MULTIPLE_CHOICE', 'EASY', 'PUBLISHED', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO techverse.exercise_questions
 (id, exercise_set_id, content, options, answer, explanation, position)
VALUES
 ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000601',
  'HTTP method nào thường dùng để tạo resource mới?', '["GET", "POST", "PUT", "DELETE"]'::jsonb,
  'POST', 'POST biểu diễn thao tác tạo resource mới.', 1),
 ('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-000000000601',
  'Mã trạng thái nào biểu thị request thành công và có dữ liệu trả về?', '["200", "301", "404", "500"]'::jsonb,
  '200', '200 OK biểu thị request đã được xử lý thành công.', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO techverse.interview_questions
 (id, author_id, topic_id, level, question, sample_answer, hint, status, published_at)
VALUES
 ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101',
  'EASY', 'REST API là gì?', 'REST API là giao diện giao tiếp qua HTTP, tổ chức quanh resource và dùng các HTTP method chuẩn.',
  'Hãy đề cập resource, HTTP và stateless.', 'PUBLISHED', now()),
 ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103',
  'MEDIUM', 'Container khác virtual machine như thế nào?', 'Container chia sẻ kernel của host và nhẹ hơn VM; VM ảo hóa cả hệ điều hành.',
  'So sánh mức độ ảo hóa và thời gian khởi động.', 'PUBLISHED', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO techverse.forum_posts (id, user_id, title, content, status)
VALUES
 ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000001',
  'Làm sao chọn index cho bảng lớn?', 'Mình đang tìm hiểu cách đọc EXPLAIN ANALYZE và chọn index phù hợp cho PostgreSQL.', 'VISIBLE')
ON CONFLICT (id) DO NOTHING;
