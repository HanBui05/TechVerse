-- TechVerse manual development seed: 24 topics and 96 tags.
-- Run AFTER Flyway V1..V7 and the initial admin has been created.
-- Connect to the project database explicitly; this does not create a database.
-- NOT a Flyway migration. Never run automatically at production startup.
-- Existing matching names (citext, case-insensitive) are preserved, including
-- descriptions, inactive status, IDs and audit fields. Safe to run repeatedly.
-- Audit actor: earliest-created active ADMIN. Does not create or alter accounts.
-- This seeds taxonomy only; articles must go through the normal author workflow.

BEGIN;
SET LOCAL search_path TO techverse, public;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'ADMIN' AND u.is_active
    ) THEN
        RAISE EXCEPTION 'Create an active ADMIN through the existing initializer before running this seed.';
    END IF;
END;
$$;

WITH seed_actor AS (
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'ADMIN' AND u.is_active
    ORDER BY u.created_at, u.id
    LIMIT 1
), seed_data(name, description) AS (
    VALUES
        ('Java Core', 'Nền tảng Java, lập trình hướng đối tượng và xử lý tập dữ liệu.'),
        ('Spring Boot', 'Xây dựng backend theo lớp, tiêm phụ thuộc và quản lý giao dịch.'),
        ('Database & SQL', 'Thiết kế dữ liệu quan hệ, truy vấn và quản lý thay đổi schema.'),
        ('Redis & Caching', 'Bộ nhớ đệm, thời hạn dữ liệu và chiến lược giảm tải truy vấn.'),
        ('Authentication & Security', 'Đăng nhập, phân quyền và bảo vệ phiên người dùng.'),
        ('JavaScript', 'Ngôn ngữ JavaScript và mô hình thực thi bất đồng bộ.'),
        ('TypeScript', 'Kiểu dữ liệu tĩnh và mô hình hóa dữ liệu an toàn.'),
        ('React', 'Giao diện thành phần, hooks và quản lý trạng thái.'),
        ('Next.js', 'Routing và tổ chức trang trong ứng dụng React dùng Next.js.'),
        ('HTML & CSS', 'Bố cục web, giao diện responsive và khả năng tiếp cận.'),
        ('Node.js', 'HTTP server, middleware và xử lý lỗi phía backend JavaScript.'),
        ('Python', 'Nền tảng Python, tổ chức dữ liệu và xử lý tập hợp.'),
        ('Data Structures & Algorithms', 'Cấu trúc dữ liệu, thuật toán và phân tích độ phức tạp.'),
        ('REST API Design', 'Thiết kế tài nguyên, phân trang và hành vi API nhất quán.'),
        ('Docker & Containers', 'Đóng gói ứng dụng và quản lý các dịch vụ phụ thuộc.'),
        ('CI/CD & DevOps', 'Tự động hóa kiểm tra, build và quản lý môi trường.'),
        ('Software Testing', 'Kiểm thử đơn vị, tích hợp và các tình huống nghiệp vụ.'),
        ('Git & Teamwork', 'Quy trình làm việc nhóm và quản lý lịch sử mã nguồn.'),
        ('System Design', 'Thiết kế hệ thống, xử lý đồng thời và khả năng mở rộng.'),
        ('Linux & Networking', 'Công cụ Linux và nền tảng kết nối dịch vụ.'),
        ('Clean Code & Design Patterns', 'Thiết kế mã dễ đọc, dễ thay đổi và các mẫu giải quyết vấn đề.'),
        ('Observability', 'Theo dõi hoạt động hệ thống qua log, metric và trace.'),
        ('Web Performance', 'Giảm chi phí tải trang và xử lý tương tác hiệu quả.'),
        ('AI Integration', 'Tích hợp mô hình ngôn ngữ với giới hạn và bảo vệ dữ liệu.')
)
INSERT INTO topics (name, description, is_active, created_by, updated_by)
SELECT d.name, d.description, true, a.id, a.id
FROM seed_data d CROSS JOIN seed_actor a
ON CONFLICT (name) DO NOTHING;

WITH seed_actor AS (
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.name = 'ADMIN' AND u.is_active
    ORDER BY u.created_at, u.id
    LIMIT 1
), seed_data(name, description) AS (
    VALUES
        ('Java', 'Nội dung về Java, thuộc nhóm kiến thức Java Core.'),
        ('OOP', 'Nội dung về OOP, thuộc nhóm kiến thức Java Core.'),
        ('Collections', 'Nội dung về Collections, thuộc nhóm kiến thức Java Core.'),
        ('Streams', 'Nội dung về Streams, thuộc nhóm kiến thức Java Core.'),
        ('Spring Boot', 'Nội dung về Spring Boot, thuộc nhóm kiến thức Spring Boot.'),
        ('Dependency Injection', 'Nội dung về Dependency Injection, thuộc nhóm kiến thức Spring Boot.'),
        ('Bean Validation', 'Nội dung về Bean Validation, thuộc nhóm kiến thức Spring Boot.'),
        ('Transactions', 'Nội dung về Transactions, thuộc nhóm kiến thức Spring Boot.'),
        ('PostgreSQL', 'Nội dung về PostgreSQL, thuộc nhóm kiến thức Database & SQL.'),
        ('SQL', 'Nội dung về SQL, thuộc nhóm kiến thức Database & SQL.'),
        ('Indexing', 'Nội dung về Indexing, thuộc nhóm kiến thức Database & SQL.'),
        ('Flyway', 'Nội dung về Flyway, thuộc nhóm kiến thức Database & SQL.'),
        ('Redis', 'Nội dung về Redis, thuộc nhóm kiến thức Redis & Caching.'),
        ('Caching', 'Nội dung về Caching, thuộc nhóm kiến thức Redis & Caching.'),
        ('TTL', 'Nội dung về TTL, thuộc nhóm kiến thức Redis & Caching.'),
        ('Cache Aside', 'Nội dung về Cache Aside, thuộc nhóm kiến thức Redis & Caching.'),
        ('JWT', 'Nội dung về JWT, thuộc nhóm kiến thức Authentication & Security.'),
        ('OAuth2', 'Nội dung về OAuth2, thuộc nhóm kiến thức Authentication & Security.'),
        ('Spring Security', 'Nội dung về Spring Security, thuộc nhóm kiến thức Authentication & Security.'),
        ('Session Management', 'Nội dung về Session Management, thuộc nhóm kiến thức Authentication & Security.'),
        ('JavaScript', 'Nội dung về JavaScript, thuộc nhóm kiến thức JavaScript.'),
        ('Async Await', 'Nội dung về Async Await, thuộc nhóm kiến thức JavaScript.'),
        ('Promises', 'Nội dung về Promises, thuộc nhóm kiến thức JavaScript.'),
        ('Event Loop', 'Nội dung về Event Loop, thuộc nhóm kiến thức JavaScript.'),
        ('TypeScript', 'Nội dung về TypeScript, thuộc nhóm kiến thức TypeScript.'),
        ('Generics', 'Nội dung về Generics, thuộc nhóm kiến thức TypeScript.'),
        ('Type Guards', 'Nội dung về Type Guards, thuộc nhóm kiến thức TypeScript.'),
        ('Utility Types', 'Nội dung về Utility Types, thuộc nhóm kiến thức TypeScript.'),
        ('React', 'Nội dung về React, thuộc nhóm kiến thức React.'),
        ('Hooks', 'Nội dung về Hooks, thuộc nhóm kiến thức React.'),
        ('Forms', 'Nội dung về Forms, thuộc nhóm kiến thức React.'),
        ('State Management', 'Nội dung về State Management, thuộc nhóm kiến thức React.'),
        ('Next.js', 'Nội dung về Next.js, thuộc nhóm kiến thức Next.js.'),
        ('SSR', 'Nội dung về SSR, thuộc nhóm kiến thức Next.js.'),
        ('Routing', 'Nội dung về Routing, thuộc nhóm kiến thức Next.js.'),
        ('Server Components', 'Nội dung về Server Components, thuộc nhóm kiến thức Next.js.'),
        ('HTML', 'Nội dung về HTML, thuộc nhóm kiến thức HTML & CSS.'),
        ('CSS', 'Nội dung về CSS, thuộc nhóm kiến thức HTML & CSS.'),
        ('Flexbox', 'Nội dung về Flexbox, thuộc nhóm kiến thức HTML & CSS.'),
        ('Accessibility', 'Nội dung về Accessibility, thuộc nhóm kiến thức HTML & CSS.'),
        ('Node.js', 'Nội dung về Node.js, thuộc nhóm kiến thức Node.js.'),
        ('Express', 'Nội dung về Express, thuộc nhóm kiến thức Node.js.'),
        ('Middleware', 'Nội dung về Middleware, thuộc nhóm kiến thức Node.js.'),
        ('Error Handling', 'Nội dung về Error Handling, thuộc nhóm kiến thức Node.js.'),
        ('Python', 'Nội dung về Python, thuộc nhóm kiến thức Python.'),
        ('Dataclasses', 'Nội dung về Dataclasses, thuộc nhóm kiến thức Python.'),
        ('Iterators', 'Nội dung về Iterators, thuộc nhóm kiến thức Python.'),
        ('Typing', 'Nội dung về Typing, thuộc nhóm kiến thức Python.'),
        ('Algorithms', 'Nội dung về Algorithms, thuộc nhóm kiến thức Data Structures & Algorithms.'),
        ('Hash Map', 'Nội dung về Hash Map, thuộc nhóm kiến thức Data Structures & Algorithms.'),
        ('Binary Search', 'Nội dung về Binary Search, thuộc nhóm kiến thức Data Structures & Algorithms.'),
        ('Big O', 'Nội dung về Big O, thuộc nhóm kiến thức Data Structures & Algorithms.'),
        ('REST API', 'Nội dung về REST API, thuộc nhóm kiến thức REST API Design.'),
        ('Pagination', 'Nội dung về Pagination, thuộc nhóm kiến thức REST API Design.'),
        ('Idempotency', 'Nội dung về Idempotency, thuộc nhóm kiến thức REST API Design.'),
        ('HTTP', 'Nội dung về HTTP, thuộc nhóm kiến thức REST API Design.'),
        ('Docker', 'Nội dung về Docker, thuộc nhóm kiến thức Docker & Containers.'),
        ('Docker Compose', 'Nội dung về Docker Compose, thuộc nhóm kiến thức Docker & Containers.'),
        ('Containers', 'Nội dung về Containers, thuộc nhóm kiến thức Docker & Containers.'),
        ('Health Checks', 'Nội dung về Health Checks, thuộc nhóm kiến thức Docker & Containers.'),
        ('CI/CD', 'Nội dung về CI/CD, thuộc nhóm kiến thức CI/CD & DevOps.'),
        ('GitHub Actions', 'Nội dung về GitHub Actions, thuộc nhóm kiến thức CI/CD & DevOps.'),
        ('Build Automation', 'Nội dung về Build Automation, thuộc nhóm kiến thức CI/CD & DevOps.'),
        ('Environment Variables', 'Nội dung về Environment Variables, thuộc nhóm kiến thức CI/CD & DevOps.'),
        ('Unit Testing', 'Nội dung về Unit Testing, thuộc nhóm kiến thức Software Testing.'),
        ('Integration Testing', 'Nội dung về Integration Testing, thuộc nhóm kiến thức Software Testing.'),
        ('JUnit', 'Nội dung về JUnit, thuộc nhóm kiến thức Software Testing.'),
        ('Mockito', 'Nội dung về Mockito, thuộc nhóm kiến thức Software Testing.'),
        ('Git', 'Nội dung về Git, thuộc nhóm kiến thức Git & Teamwork.'),
        ('Branching', 'Nội dung về Branching, thuộc nhóm kiến thức Git & Teamwork.'),
        ('Commit Convention', 'Nội dung về Commit Convention, thuộc nhóm kiến thức Git & Teamwork.'),
        ('Merge', 'Nội dung về Merge, thuộc nhóm kiến thức Git & Teamwork.'),
        ('System Design', 'Nội dung về System Design, thuộc nhóm kiến thức System Design.'),
        ('Concurrency', 'Nội dung về Concurrency, thuộc nhóm kiến thức System Design.'),
        ('Rate Limiting', 'Nội dung về Rate Limiting, thuộc nhóm kiến thức System Design.'),
        ('Scalability', 'Nội dung về Scalability, thuộc nhóm kiến thức System Design.'),
        ('Linux', 'Nội dung về Linux, thuộc nhóm kiến thức Linux & Networking.'),
        ('TCP/IP', 'Nội dung về TCP/IP, thuộc nhóm kiến thức Linux & Networking.'),
        ('DNS', 'Nội dung về DNS, thuộc nhóm kiến thức Linux & Networking.'),
        ('Reverse Proxy', 'Nội dung về Reverse Proxy, thuộc nhóm kiến thức Linux & Networking.'),
        ('Clean Code', 'Nội dung về Clean Code, thuộc nhóm kiến thức Clean Code & Design Patterns.'),
        ('SOLID', 'Nội dung về SOLID, thuộc nhóm kiến thức Clean Code & Design Patterns.'),
        ('Strategy Pattern', 'Nội dung về Strategy Pattern, thuộc nhóm kiến thức Clean Code & Design Patterns.'),
        ('Refactoring', 'Nội dung về Refactoring, thuộc nhóm kiến thức Clean Code & Design Patterns.'),
        ('Logging', 'Nội dung về Logging, thuộc nhóm kiến thức Observability.'),
        ('Metrics', 'Nội dung về Metrics, thuộc nhóm kiến thức Observability.'),
        ('Tracing', 'Nội dung về Tracing, thuộc nhóm kiến thức Observability.'),
        ('Correlation ID', 'Nội dung về Correlation ID, thuộc nhóm kiến thức Observability.'),
        ('Performance', 'Nội dung về Performance, thuộc nhóm kiến thức Web Performance.'),
        ('Lazy Loading', 'Nội dung về Lazy Loading, thuộc nhóm kiến thức Web Performance.'),
        ('Debouncing', 'Nội dung về Debouncing, thuộc nhóm kiến thức Web Performance.'),
        ('Web Vitals', 'Nội dung về Web Vitals, thuộc nhóm kiến thức Web Performance.'),
        ('AI', 'Nội dung về AI, thuộc nhóm kiến thức AI Integration.'),
        ('LLM', 'Nội dung về LLM, thuộc nhóm kiến thức AI Integration.'),
        ('Prompting', 'Nội dung về Prompting, thuộc nhóm kiến thức AI Integration.'),
        ('Data Privacy', 'Nội dung về Data Privacy, thuộc nhóm kiến thức AI Integration.')
)
INSERT INTO tags (name, description, is_active, created_by, updated_by)
SELECT d.name, d.description, true, a.id, a.id
FROM seed_data d CROSS JOIN seed_actor a
ON CONFLICT (name) DO NOTHING;

COMMIT;
