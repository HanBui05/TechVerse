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

## Tài khoản dev theo vai trò

| Vai trò | Email | Mật khẩu | Nguồn |
|---|---|---|---|
| ADMIN (+LEARNER) | `INITIAL_ADMIN_EMAIL` | `INITIAL_ADMIN_PASSWORD` | `.env`, mặc định trong `application-dev.yaml`; tạo bởi `InitialAdminInitializer` |
| MODERATOR (+LEARNER) | `moderator@techverse.test` | giống `INITIAL_ADMIN_PASSWORD` (chép hash từ admin) | Chèn tay vào DB dev 2026-11-03; không có trong migration — DB mới thì chèn lại bằng lệnh dưới |
| AUTHOR | chưa có | — | Cần thì tạo learner rồi duyệt hồ sơ Author bằng Admin |

```sql
-- Chạy trong psql (schema techverse); idempotent.
insert into users (full_name, email, password)
  select 'Dev Moderator', 'moderator@techverse.test', password from users where email = '<INITIAL_ADMIN_EMAIL>'
  on conflict (email) do nothing;
insert into user_roles (user_id, role_id)
  select u.id, r.id from users u, roles r where u.email = 'moderator@techverse.test' and r.name in ('LEARNER', 'MODERATOR')
  on conflict do nothing;
```

## Luồng phiên đăng nhập (frontend)

- Access token chỉ ở bộ nhớ (`setAccessToken`); refresh token là cookie HttpOnly. Tải lại trang thì `App` gọi `/api/v1/auth/refresh` để khôi phục, cờ `localStorage['techverse-authenticated']` cho biết có nên thử.
- Khi tự động hóa trình duyệt: đăng nhập qua form `/login`, rồi đổi route bằng `history.pushState` + `popstate` để khỏi tải lại trang.
- Sau đăng nhập: ADMIN → `/admin`, MODERATOR → `/moderator`, còn lại → `/`.
