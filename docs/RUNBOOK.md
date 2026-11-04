# Runbook — chạy TechVerse trên máy dev

Đọc trước khi cần chạy app thật (kiểm bằng mắt, thử API). Giá trị cụ thể nằm ở file nguồn ghi bên cạnh; file này chỉ ghi chúng nằm ở đâu.

## Thành phần

| Thành phần | Chạy thế nào | Cổng / nguồn cấu hình |
|---|---|---|
| Postgres 16 + Redis 7 | `docker compose up -d` (gốc repo, `compose.yaml`) | `POSTGRES_HOST_PORT` (5432), `REDIS_HOST_PORT` (6379) trong `.env` |
| Backend Spring Boot | Thường người dùng chạy từ IntelliJ, profile `dev`. Tự chạy: `cd server && ./gradlew bootRun --args='--spring.profiles.active=dev'` | 8080; cấu hình `server/src/main/resources/application.yaml` + `application-dev.yaml` |
| Frontend Vite | `cd app && npm run dev -- --port 3000 --strictPort` | Cổng phải bằng `WEB_URL` trong `.env` (hiện `http://localhost:3000`); API ở `VITE_API_BASE_URL` (mặc định `http://localhost:8080`) |

- **CORS:** backend chỉ nhận origin `WEB_URL` (`SecurityConfiguration.corsConfigurationSource`). Frontend chạy cổng khác → preflight 403, đăng nhập báo “lỗi hệ thống”.
- **DB:** database `POSTGRES_DB`, schema `techverse` (Hikari đặt `search_path`). `psql` trong container: `docker exec techverse psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "set search_path=techverse; ..."`.
- **Đã có tiến trình đang chạy** (cổng 3000/8080 bận): kiểm `Get-NetTCPConnection -LocalPort <cổng>` + `CommandLine` của tiến trình. Của người dùng thì dùng chung, không tắt, không khởi động lại.
- **Backend có đúng code không:** so `CreationDate` của tiến trình 8080 với lần sửa `server/` cuối (`git log -1 --format=%ci -- server`, cộng file chưa commit). Backend cũ hơn → ghi “chưa kiểm: backend chạy code cũ” và báo người dùng, không tự khởi động lại.

## Làm mới DB dev (khi Flyway mới không chạy trên dữ liệu cũ)

V10 (`article-flow`) dừng nếu bảng `articles` đã có dữ liệu (không backfill, D-022). Tắt backend rồi xóa schema + Redis; lần khởi động sau Flyway chạy lại từ V1 và `InitialAdminInitializer` tạo lại admin; sau đó chèn lại Moderator (lệnh dưới) và chạy `scripts/dev-seed-admin.sql` nếu cần.

```bash
docker compose exec postgres psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "DROP SCHEMA techverse CASCADE"
docker compose exec redis redis-cli FLUSHALL
```

Chạy ở gốc repo. Chỉ làm trên DB dev, mất toàn bộ dữ liệu.

## Tài khoản dev theo vai trò

| Vai trò | Email | Mật khẩu | Nguồn |
|---|---|---|---|
| ADMIN (+LEARNER) | `INITIAL_ADMIN_EMAIL` | `INITIAL_ADMIN_PASSWORD` | `.env`, mặc định trong `application-dev.yaml`; tạo bởi `InitialAdminInitializer` |
| MODERATOR (+LEARNER) | `moderator@techverse.test` | giống `INITIAL_ADMIN_PASSWORD` (chép hash từ admin) | Chèn tay vào DB dev 2026-11-03; không có trong migration — DB mới thì chèn lại bằng lệnh dưới |
| AUTHOR | `bao.author@techverse.test` (đã duyệt), `huy.author@techverse.test` (đang đình chỉ) | giống `INITIAL_ADMIN_PASSWORD` | Seed dev `scripts/dev-seed-admin.sql` (mục dưới) |

```sql
-- Chạy trong psql (schema techverse); idempotent.
insert into users (full_name, email, password)
  select 'Dev Moderator', 'moderator@techverse.test', password from users where email = '<INITIAL_ADMIN_EMAIL>'
  on conflict (email) do nothing;
insert into user_roles (user_id, role_id)
  select u.id, r.id from users u, roles r where u.email = 'moderator@techverse.test' and r.name in ('LEARNER', 'MODERATOR')
  on conflict do nothing;
```

## Dữ liệu mẫu cho trang Admin (chỉ DB dev)

`scripts/dev-seed-admin.sql` (thêm 2026-11-03 theo yêu cầu người dùng): 6 learner `*.author@techverse.test` (1 bị khóa), hồ sơ tác giả đủ trạng thái PENDING/APPROVED/REJECTED/SUSPENDED + lịch sử duyệt, 8 chủ đề, 12 thẻ (mỗi loại 1 mục ngừng hoạt động). Không phải migration Flyway, không chạy ở production. Idempotent; mật khẩu chép hash từ admin.

```bash
# Compose (service postgres):
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v admin_email=<INITIAL_ADMIN_EMAIL>' < scripts/dev-seed-admin.sql
# Container chạy riêng (máy hiện tại: tên `techverse`):
docker exec -i techverse sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v admin_email=<INITIAL_ADMIN_EMAIL>' < scripts/dev-seed-admin.sql
```

User/DB lấy từ biến môi trường trong container (Compose mặc định `techverse`, container hiện tại `root`). Không tìm thấy admin → seed báo lỗi và rollback toàn bộ. Console Windows có thể hiển thị lỗi vài ký tự tiếng Việt khi in kết quả; dữ liệu lưu đúng UTF-8.

## Luồng phiên đăng nhập (frontend)

- Access token chỉ ở bộ nhớ (`setAccessToken`); refresh token là cookie HttpOnly. Tải lại trang thì `App` gọi `/api/v1/auth/refresh` để khôi phục, cờ `localStorage['techverse-authenticated']` cho biết có nên thử.
- Khi tự động hóa trình duyệt: đăng nhập qua form `/login`, rồi đổi route bằng `history.pushState` + `popstate` để khỏi tải lại trang.
- Sau đăng nhập: ADMIN → `/admin`, MODERATOR → `/moderator`, còn lại → `/`.
