# Runbook — chạy TechVerse trên máy dev

Đọc trước khi cần chạy app thật (kiểm bằng mắt, thử API). Giá trị cụ thể nằm ở file nguồn ghi bên cạnh; file này chỉ ghi chúng nằm ở đâu.

## Thành phần

| Thành phần | Chạy thế nào | Cổng / nguồn cấu hình |
|---|---|---|
| Postgres 16 + Redis 7 | `docker compose up -d` (gốc repo, `compose.yaml`) | `POSTGRES_HOST_PORT` (5432), `REDIS_HOST_PORT` (6379) trong `.env` |
| Backend Spring Boot | Thường người dùng chạy từ IntelliJ, profile `dev`. Tự chạy: `cd server && ./gradlew bootRun --args='--spring.profiles.active=dev'` | 8080; cấu hình `server/src/main/resources/application.yaml` + `application-dev.yaml` |
| Frontend Vite | `cd app && npm run dev -- --port 3000 --strictPort` | Cổng phải bằng `WEB_URL` trong `.env` (hiện `http://localhost:3000`); API ở `VITE_API_BASE_URL` (mặc định `http://localhost:8080`) |

- **CORS:** backend chỉ nhận origin `WEB_URL` (`SecurityConfiguration.corsConfigurationSource`). Frontend chạy cổng khác → preflight 403, đăng nhập báo “lỗi hệ thống”.
- **WebSocket nhắn tin (`/ws/messaging?ticket=…`):** chỉ nhận `Origin` = `WEB_URL`; vé một lần (30 giây) nằm trong query nên backend không bật access log ghi query. Khi triển khai sau proxy/reverse proxy: proxy phải chuyển tiếp nâng cấp WebSocket và **không ghi query string của đường này** vào log. Socket giữ trong bộ nhớ, chỉ đúng khi chạy một backend.
- **DB:** database `POSTGRES_DB`, schema `techverse` (Hikari đặt `search_path`). `psql` trong container: `docker exec techverse psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "set search_path=techverse; ..."`.
- **Đã có tiến trình đang chạy** (cổng 3000/8080 bận): kiểm `Get-NetTCPConnection -LocalPort <cổng>` + `CommandLine` của tiến trình. Của người dùng thì dùng chung, không tắt, không khởi động lại.
- **Backend có đúng code không:** so `CreationDate` của tiến trình 8080 với lần sửa `server/` cuối (`git log -1 --format=%ci -- server`, cộng file chưa commit). Backend cũ hơn → ghi “chưa kiểm: backend chạy code cũ” và báo người dùng, không tự khởi động lại.
- **Devtools + Gradle (2026-11-16):** IntelliJ chạy từ `server/build/classes/java/main` với devtools; `./gradlew test` biên dịch lại vào đó → devtools khởi động lại giữa lúc Gradle đang ghi → backend lên **thiếu controller/service vừa ghi** (route của chúng trả 500 `INTERNAL_ERROR` như route không tồn tại, vì `GlobalExceptionHandler` biến “không có route” thành 500). Sau khi chạy test backend mà người dùng định thử app thật: nhắc người dùng Stop → Run lại backend.

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

## Chạy payOS trên máy cá nhân

1. Lấy khóa ở `my.payos.vn` (kênh thanh toán): điền `.env` đủ bốn biến `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_RETURN_BASE_URL` (URL frontend, vd. `http://localhost:5173`). Thiếu một biến hoặc URL sai dạng → payOS tắt, đơn mới đi VietQR thủ công. Khởi động lại backend.
2. Mở đường từ ngoài vào backend: `ngrok http 8080` → lấy URL `https://<id>.ngrok-free.app`.
3. Đăng ký webhook `https://<id>.ngrok-free.app/api/v1/payments/payos/webhook`: ở `my.payos.vn` (mục webhook của kênh) hoặc `curl -X POST https://api-merchant.payos.vn/confirm-webhook -H "x-client-id: …" -H "x-api-key: …" -H "Content-Type: application/json" -d '{"webhookUrl":"<URL trên>"}'`. payOS gửi một payload mẫu; backend trả 200 vì không khớp đơn nào.
4. Webhook chỉ là tín hiệu: backend luôn tra cứu `GET /v2/payment-requests/{số đơn}` rồi mới cấp quyền. Webhook lỡ (ngrok tắt, URL đổi) thì học viên bấm kiểm tra (`POST /api/v1/orders/{mã}/sync`) hoặc Admin (`POST /api/v1/admin/orders/{mã}/sync`).
5. Mỗi lần ngrok đổi URL phải đăng ký lại bước 3. Lần thử thật đầu tiên ghi vào log module: payOS có từ chối tạo trùng số đơn không, khoảng `orderCode`, số tiền tối thiểu.

## Luồng phiên đăng nhập (frontend)

- Access token ở biến bộ nhớ và `sessionStorage['techverse-access-token']` (`setAccessToken` trong `client.ts`, mất khi đóng tab); refresh token là cookie HttpOnly. Tải lại trang thì `App` gọi `/api/v1/auth/refresh` để khôi phục, cờ `localStorage['techverse-authenticated']` cho biết có nên thử.
- Khi tự động hóa trình duyệt: đăng nhập qua form `/login`, rồi đổi route bằng `history.pushState` + `popstate` để khỏi tải lại trang.
- Sau đăng nhập: ADMIN → `/admin`, MODERATOR → `/moderator`, còn lại → `/`.
