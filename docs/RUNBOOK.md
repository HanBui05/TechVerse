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

## Triển khai lên Railway (demo)

Mô hình (quyết định 2026-11-23, `plans/deploy-readiness.md`): một project Railway gồm 4 dịch vụ: `Postgres`, `Redis` (dịch vụ có sẵn của Railway), `server` (backend), `app` (frontend). Frontend ở `https://<tên-miền>`, backend ở `https://api.<tên-miền>`. Hai tên miền cùng site nên cookie refresh `SameSite=Lax` chạy được, không cần rewrite `/api`. Thay `<tên-miền>` bằng tên miền đã mua.

### 1. Tạo dịch vụ

1. Railway → New Project → Deploy from GitHub repo (repo TechVerse) → tạo dịch vụ `server`: Settings → Root Directory `server` (Railway dùng `server/Dockerfile`). Branch deploy: nhánh bạn muốn demo.
2. Thêm dịch vụ thứ hai từ cùng repo, đặt tên `app`, Root Directory `app` (Railpack nhận ra Vite, build `npm run build`, phục vụ `dist` bằng Caddy).
3. New → Database → PostgreSQL; New → Database → Redis. Giữ tên mặc định `Postgres`, `Redis` (tên này dùng trong biến tham chiếu bên dưới).

### 2. Biến môi trường `server`

Railway → `server` → Variables. Cú pháp `${{Dịch_vụ.BIẾN}}` là biến tham chiếu của Railway (tự cập nhật khi DB đổi mật khẩu).

| Biến | Giá trị |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `prod` |
| `DATABASE_HOST` / `DATABASE_PORT` | `${{Postgres.PGHOST}}` / `${{Postgres.PGPORT}}` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `${{Postgres.PGDATABASE}}` / `${{Postgres.PGUSER}}` / `${{Postgres.PGPASSWORD}}` |
| `REDIS_HOST` / `REDIS_PORT` | `${{Redis.REDISHOST}}` / `${{Redis.REDISPORT}}` |
| `REDIS_USERNAME` / `REDIS_PASSWORD` | `${{Redis.REDISUSER}}` / `${{Redis.REDISPASSWORD}}` (`REDIS_SSL` để trống = `false`; mạng nội bộ Railway không dùng TLS) |
| `WEB_URL` | `https://<tên-miền>` — **đúng từng ký tự, không `/` cuối**: CORS và WebSocket so khớp chính xác với header `Origin` |
| `JWT_SECRET_KEY` | Chuỗi **Base64** ≥ 32 byte, tạo mới: `openssl rand -base64 48` (không dùng lại khóa dev; khóa không Base64 làm backend không khởi động) |
| `PASSWORD_RESET_SECRET` | Chuỗi ngẫu nhiên khác, `openssl rand -base64 48` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Từ Google Cloud Console (bước 4) |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`, `SENDGRID_TEMPLATE_REGISTER_SUCCESS`, `SENDGRID_TEMPLATE_RESET_PASSWORD_OTP` | Như `.env` dev (profile prod bắt buộc 4 biến đầu) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Như `.env` dev; phải khai báo (để trống thì tải ảnh tắt) |
| `AI_MODEL_CHAT`, `AI_API_KEY`, … | Như `.env.example` (mặc định `none` = tắt AI) |
| `VIETQR_*`, `PAYOS_*` | Như `.env.example`; `PAYOS_RETURN_BASE_URL=https://<tên-miền>` |
| `JAVA_TOOL_OPTIONS` | `-XX:MaxRAMPercentage=70` — giữ JVM dưới giới hạn RAM của gói (trial 1 GB/dịch vụ) |

- Không cần đặt `SERVER_PORT`: profile prod nghe cổng `PORT` Railway cấp (mặc định 8080).
- Profile prod không tạo admin (`InitialAdminInitializer` chỉ chạy ở `dev`). Tạo admin: đăng ký một tài khoản trên web, rồi ở Railway → `Postgres` → Database → Query chạy:
  ```sql
  insert into techverse.user_roles (user_id, role_id)
    select u.id, r.id from techverse.users u, techverse.roles r where u.email = '<email>' and r.name = 'ADMIN'
    on conflict do nothing;
  ```
  Moderator làm tương tự với `r.name = 'MODERATOR'`. Không chạy `scripts/dev-seed-admin.sql` trên production.
- Flyway tự tạo schema `techverse` lần khởi động đầu.

### 3. Biến môi trường `app`

| Biến | Giá trị |
|---|---|
| `VITE_API_BASE_URL` | `https://api.<tên-miền>` (không `/` cuối). Vite chép giá trị vào bundle **lúc build**: đổi biến này phải Redeploy `app`. WebSocket tự đổi thành `wss://api.<tên-miền>/ws/messaging`. |
| `RAILPACK_SPA_OUTPUT_DIR` | `dist` — bật chế độ SPA (mọi đường dẫn lạ trả `index.html`) để F5 ở `/courses` không ra 404 |

### 4. Tên miền, HTTPS, Google OAuth

1. `server` → Settings → Networking → `+ Custom Domain` → `api.<tên-miền>`; `app` → `+ Custom Domain` → `<tên-miền>`. Railway hiện một bản ghi **CNAME** và một bản ghi **TXT** cho mỗi tên miền: thêm **cả hai** ở nhà cung cấp DNS (thiếu TXT thì Railway trả 404). Tên miền gốc (`<tên-miền>` không có `www`) cần DNS hỗ trợ CNAME flattening/ALIAS (Cloudflare có); nếu nhà cung cấp không hỗ trợ, chuyển DNS sang Cloudflare. Ở Cloudflare để bản ghi **DNS only** (đám mây xám, tắt proxy): TLS do Railway lo từ đầu đến cuối; bật proxy thì Railway yêu cầu SSL/TLS `Full`, chế độ này không xác thực chứng chỉ origin.
2. Railway tự cấp chứng chỉ Let's Encrypt; chờ trạng thái tên miền xanh.
3. Google Cloud Console → APIs & Services → Credentials → OAuth client: thêm **Authorized redirect URI** `https://api.<tên-miền>/login/oauth2/code/google` và **Authorized JavaScript origin** `https://<tên-miền>`. OAuth consent screen ở chế độ Testing thì thêm email người demo vào Test users.
4. payOS (nếu bật): đăng ký webhook `https://api.<tên-miền>/api/v1/payments/payos/webhook` (mục “Chạy payOS” ở trên, bước 3 — không cần ngrok).

### 5. Kiểm sau khi deploy

1. Log `server` có `Started ServerApplication` và `The following 1 profile is active: "prod"`.
2. `curl -sI https://api.<tên-miền>/oauth2/authorization/google` → header `Location` chứa `redirect_uri=https%3A%2F%2Fapi.<tên-miền>…` (**https**). Nếu ra `http`, proxy Railway không nằm trong dải IP nội bộ Tomcat tin cậy: thêm biến `GOOGLE_REDIRECT_URI=https://api.<tên-miền>/login/oauth2/code/google` cho `server` rồi Redeploy. Khi đó giới hạn theo IP của quên mật khẩu tính chung cho mọi người (thấy IP proxy); chấp nhận được cho demo. **Không** đặt `SERVER_TOMCAT_REMOTEIP_INTERNAL_PROXIES=.*`: Tomcat sẽ tin IP do client tự ghi trong `X-Forwarded-For`, mở đường né giới hạn.
3. Mở `https://<tên-miền>/courses` trực tiếp (F5) → trang Khóa học, không 404. Đăng nhập email + Google, F5 vẫn giữ phiên (cookie refresh). Mở trang nhắn tin: không lỗi WebSocket trong Console.

### 6. Chi phí và bật/tắt (quyết định 2026-11-23)

- Dùng gói trial Railway (30 ngày, có credit). Theo dõi Railway → Usage; hết trial/credit thì phải lên gói trả phí, nếu không dịch vụ dừng. **Deploy sát ngày báo cáo** để trial còn hạn lúc báo cáo.
- Không chạy 24/7, chỉ bật khi code/test và lúc báo cáo (1–2 giờ). Hai cách:
  - **Dừng/bật thủ công (khuyên dùng trước buổi báo cáo):** dịch vụ → Settings → xóa deployment đang chạy (Remove) hoặc dùng nút Restart/Redeploy khi cần bật lại. Postgres/Redis giữ dữ liệu trong volume.
  - **Serverless (App Sleeping):** `server`/`app` → Settings → bật Serverless, rồi Redeploy (chỉ có hiệu lực sau deploy mới). Dịch vụ ngủ sau 5–10 phút không có lưu lượng ra; kết nối DB mở (Hikari) có thể giữ `server` thức nên `server` có thể không ngủ.
- **Khởi động lạnh:** Spring Boot mất khoảng 50 giây (đo cục bộ 2026-11-23, profile prod 48 giây); request đầu khi dịch vụ đang ngủ có thể nhận 502. Trước buổi báo cáo 5 phút: mở `https://<tên-miền>` và gọi `curl https://api.<tên-miền>/oauth2/authorization/google` để đánh thức, chờ log `Started ServerApplication`.
- RAM: `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=70` (bảng bước 2) để JVM không vượt 1 GB/dịch vụ của trial.
- Chỉ chạy một bản `server` (không tăng Replicas): WebSocket nhắn tin và registry AI giữ trong bộ nhớ.
