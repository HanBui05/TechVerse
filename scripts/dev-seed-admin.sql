-- Dev-only seed for testing Admin pages: author applications (every status), topics, tags.
-- NOT a Flyway migration; never run against production. Idempotent: re-running changes nothing.
-- Run (Compose service `postgres`; DB user/name come from the container env), from the repo root:
--   docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v admin_email=<INITIAL_ADMIN_EMAIL>' < scripts/dev-seed-admin.sql
-- Seed users log in with the same password as the admin (hash copied), emails @techverse.test.
set search_path to techverse, public;
begin;

-- Every author row depends on the admin (password hash, reviewer); abort the whole seed instead of committing half of it.
select set_config('seed.admin_email', :'admin_email', true);
do $$
begin
  if not exists (select 1 from techverse.users where email = current_setting('seed.admin_email')) then
    raise exception 'Seed aborted: admin % not found (run after InitialAdminInitializer, check admin_email)', current_setting('seed.admin_email');
  end if;
end $$;

-- Learner accounts (one locked) that own the applications.
insert into users (full_name, email, password, is_active)
select v.full_name, v.email, a.password, v.active
from (values
  ('Lê Thu Hoa', 'hoa.author@techverse.test', true),
  ('Phạm Quốc Bảo', 'bao.author@techverse.test', true),
  ('Ngô Minh Tú', 'tu.author@techverse.test', true),
  ('Đặng Gia Huy', 'huy.author@techverse.test', true),
  ('Võ Ngọc Lan', 'lan.author@techverse.test', true),
  ('Trịnh Khánh Linh', 'linh.author@techverse.test', false)
) as v(full_name, email, active)
cross join (select password from users where email = :'admin_email') a
on conflict (email) do nothing;

insert into user_roles (user_id, role_id)
select u.id, r.id from users u join roles r on r.name = 'LEARNER'
where u.email like '%.author@techverse.test'
on conflict (user_id, role_id) do nothing;

-- Approving adds AUTHOR (AdminAuthorApplicationServiceImpl); suspending keeps the role.
insert into user_roles (user_id, role_id)
select u.id, r.id from users u join roles r on r.name = 'AUTHOR'
where u.email in ('bao.author@techverse.test', 'huy.author@techverse.test')
on conflict (user_id, role_id) do nothing;

-- One application per status; Lan resubmitted after a rejection (pending, with history).
insert into author_profiles (user_id, bio, expertise, portfolio_url, status, review_note, reviewed_by, reviewed_at, suspension_reason, suspended_by, suspended_at, version, created_at)
select u.id, v.bio, v.expertise, v.portfolio, v.status, v.review_note,
       case when v.reviewed then a.id end, case when v.reviewed then now() - v.reviewed_ago end,
       v.suspension_reason, case when v.status = 'SUSPENDED' then a.id end, case when v.status = 'SUSPENDED' then now() - interval '1 day' end,
       v.version, now() - v.created_ago
from (values
  ('hoa.author@techverse.test', E'Backend developer 6 năm kinh nghiệm với Java và Spring Boot.\nMuốn chia sẻ về JVM, hiệu năng và kiến trúc microservice.', 'Java, Spring Boot', 'https://github.com/example-hoa', 'PENDING', null, false, interval '0', null, 0, interval '2 days'),
  ('bao.author@techverse.test', 'Frontend engineer, đã viết nhiều bài về React và TypeScript trên blog cá nhân.', 'React, TypeScript', 'https://example.com/bao', 'APPROVED', 'Bài mẫu rõ ràng, đúng chuyên môn.', true, interval '10 days', null, 1, interval '15 days'),
  ('tu.author@techverse.test', 'Quan tâm DevOps, mới bắt đầu viết.', 'DevOps, Docker', null, 'REJECTED', 'Chưa có bài viết mẫu để đánh giá chất lượng nội dung.', true, interval '5 days', null, 1, interval '8 days'),
  ('huy.author@techverse.test', 'Data engineer, chia sẻ về SQL, PostgreSQL và pipeline dữ liệu.', 'PostgreSQL, Data', 'https://example.com/huy', 'SUSPENDED', 'Hồ sơ đạt yêu cầu.', true, interval '20 days', 'Đăng lại nội dung sao chép từ nguồn khác.', 2, interval '25 days'),
  ('lan.author@techverse.test', E'Mobile developer (Flutter, Kotlin).\nĐã bổ sung 2 bài viết mẫu theo góp ý.', 'Flutter, Kotlin', 'https://example.com/lan', 'PENDING', 'Thiếu bài viết mẫu.', true, interval '3 days', null, 2, interval '9 days'),
  ('linh.author@techverse.test', 'Tester, muốn viết về kiểm thử tự động.', 'Testing, Playwright', null, 'PENDING', null, false, interval '0', null, 0, interval '1 day')
) as v(email, bio, expertise, portfolio, status, review_note, reviewed, reviewed_ago, suspension_reason, version, created_ago)
join users u on u.email = v.email
cross join (select id from users where email = :'admin_email') a
on conflict (user_id) do nothing;

-- Review history (shown as a timeline in the Admin detail sheet); only for profiles that have none yet.
insert into author_application_reviews (author_profile_id, application_version, decision, review_note, reviewed_at, reviewed_by, reviewer_name_snapshot, bio_snapshot, expertise_snapshot, portfolio_url_snapshot)
select p.id, v.app_version, v.decision, v.note, now() - v.ago, a.id, a.full_name, p.bio, p.expertise, p.portfolio_url
from (values
  ('bao.author@techverse.test', 0, 'APPROVED', 'Bài mẫu rõ ràng, đúng chuyên môn.', interval '10 days'),
  ('tu.author@techverse.test', 0, 'REJECTED', 'Chưa có bài viết mẫu để đánh giá chất lượng nội dung.', interval '5 days'),
  ('huy.author@techverse.test', 0, 'APPROVED', 'Hồ sơ đạt yêu cầu.', interval '20 days'),
  ('lan.author@techverse.test', 0, 'REJECTED', 'Thiếu bài viết mẫu.', interval '3 days')
) as v(email, app_version, decision, note, ago)
join users u on u.email = v.email
join author_profiles p on p.user_id = u.id
cross join (select id, full_name from users where email = :'admin_email') a
where not exists (select 1 from author_application_reviews r where r.author_profile_id = p.id);

insert into topics (name, description, is_active) values
  ('Java', 'Ngôn ngữ, JVM, Collections, Concurrency và các phiên bản mới.', true),
  ('Spring Boot', 'Xây dựng REST API, bảo mật, JPA và kiểm thử với Spring.', true),
  ('Frontend', 'React, TypeScript, CSS và trải nghiệm người dùng.', true),
  ('DevOps', 'CI/CD, Docker, Kubernetes và vận hành hệ thống.', true),
  ('Cơ sở dữ liệu', 'SQL, PostgreSQL, tối ưu truy vấn và thiết kế schema.', true),
  ('Kiến trúc phần mềm', 'Microservice, clean architecture, design pattern.', true),
  ('AI & Machine Learning', 'LLM, RAG và ứng dụng AI vào sản phẩm.', true),
  ('Phỏng vấn', 'Kinh nghiệm và câu hỏi phỏng vấn lập trình viên.', false)
on conflict (name) do nothing;

insert into tags (name, description, is_active) values
  ('java', 'Bài viết liên quan Java.', true),
  ('spring', 'Spring Framework và Spring Boot.', true),
  ('react', 'Thư viện React.', true),
  ('typescript', null, true),
  ('docker', 'Container và Docker Compose.', true),
  ('kubernetes', null, true),
  ('postgresql', 'Cơ sở dữ liệu PostgreSQL.', true),
  ('redis', 'Cache và message với Redis.', true),
  ('testing', 'Unit test, integration test, e2e.', true),
  ('performance', 'Tối ưu hiệu năng.', true),
  ('security', 'Bảo mật ứng dụng web.', true),
  ('legacy', 'Thẻ cũ, không còn dùng.', false)
on conflict (name) do nothing;

commit;

-- Seed rows only, not whole-table totals: 6 / 4 / 8 / 12 on a fresh DB (reviews grow when admins act on seed profiles).
select (select count(*) from author_profiles p join users u on u.id = p.user_id where u.email like '%.author@techverse.test') as seed_profiles,
       (select count(*) from author_application_reviews r join author_profiles p on p.id = r.author_profile_id join users u on u.id = p.user_id where u.email like '%.author@techverse.test') as seed_reviews,
       (select count(*) from topics where name in ('Java', 'Spring Boot', 'Frontend', 'DevOps', 'Cơ sở dữ liệu', 'Kiến trúc phần mềm', 'AI & Machine Learning', 'Phỏng vấn')) as seed_topics,
       (select count(*) from tags where name in ('java', 'spring', 'react', 'typescript', 'docker', 'kubernetes', 'postgresql', 'redis', 'testing', 'performance', 'security', 'legacy')) as seed_tags;
