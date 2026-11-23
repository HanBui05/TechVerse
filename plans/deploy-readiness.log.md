# Nhật ký deploy readiness

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Brief: [`deploy-readiness.md`](deploy-readiness.md).

## Bắt đầu từ đây (cập nhật 2026-11-23)

- **Task tiếp:** không còn task; người dùng deploy theo RUNBOOK khi có tên miền, lỗi thì gửi log Railway · Giao diện: Không
- Task 1, Task 2 đã nhận (2026-11-23).
- Task 2 chưa kiểm trên Railway thật: SPA fallback (`RAILPACK_SPA_OUTPUT_DIR`), IP proxy Railway có nằm trong dải Tomcat tin cậy không (RUNBOOK bước 5.2 có cách xử lý).
- Nhánh `feature/deploy-readiness` (từ `main`), Task 1 + 2 đã commit cục bộ, chưa push.

## Quyết định người dùng chưa có trong spec

- 2026-11-23 — Không sửa góp ý Codex vòng 2 Task 1 (reload về trang nguồn): theo khuyến nghị Claude, đã chứng minh bằng mã nguồn router + kiểm mắt. Màn lỗi tiếng Việt khi chunk lỗi mãi: để task riêng nếu cần.
- 2026-11-23 — Postgres + Redis dùng dịch vụ có sẵn của Railway (không Supabase/Upstash); dùng gói trial Railway 30 ngày. RUNBOOK Task 2 ghi: theo dõi Usage, gói trả phí khi hết trial/credit.
- 2026-11-23 — Không chạy 24/7: chỉ bật khi code/test và lúc báo cáo môn học (1–2 giờ). RUNBOOK Task 2: bật App Sleeping hoặc dừng/bật dịch vụ thủ công, khởi động lạnh Spring Boot, deploy sát ngày báo cáo (trial 30 ngày), giới hạn heap JVM vì trial 1 GB RAM/dịch vụ.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-23 — Task 2: cấu hình triển khai Railway
- Người dùng nhận Task 2 (2026-11-23).
- `application-prod.yaml`: Redis `username`/`password`/`ssl.enabled` qua `REDIS_USERNAME`/`REDIS_PASSWORD`/`REDIS_SSL`; **thêm Google OAuth + SendGrid** (trước chỉ có ở dev → prod không khởi động được); `server.port: ${SERVER_PORT:${PORT:8080}}`; `forward-headers-strategy: native` (để `{baseUrl}` OAuth ra https và `getRemoteAddr` của rate limit quên mật khẩu là IP khách, không phải proxy). Lệch khác spec: 3 mục sau không có trong brief, cần để deploy chạy.
- RUNBOOK mục “Triển khai lên Railway”: dịch vụ, biến `server`/`app` (biến tham chiếu `${{Postgres.PGHOST}}`…), Custom Domain CNAME+TXT, Google redirect URI, kiểm sau deploy, chi phí/bật-tắt/khởi động lạnh/heap. `JWT_SECRET_KEY` phải Base64; prod không tạo admin → SQL gán vai trò.
- Sửa nhầm: tưởng khóa JWT trong `.env` không phải Base64, thực ra Git Bash đổi giá trị có `/` thành đường dẫn Windows khi truyền cho `java` (thêm `:`). Theo yêu cầu người dùng đã thay khóa `.env` bằng khóa Base64 mới (khóa cũ không giữ lại; phiên đăng nhập cũ mất nếu backend đọc `.env`) và sửa mẫu `.env.example` (mẫu cũ có `-`, thật sự không phải Base64). Smoke lại với `MSYS2_ENV_CONV_EXCL='*'` và khóa `.env`: `Started ServerApplication in 46.596 seconds`, `redirect_uri` https.
- Kiểm: `bootJar` + `java -jar` profile prod cổng 8090, DB/Redis local, khóa JWT tạm → `Started ServerApplication in 47.975 seconds`; `/oauth2/authorization/google` với `X-Forwarded-Proto: https` → `redirect_uri=https://api.example.test/login/oauth2/code/google`. Không chạy test Gradle (chỉ đổi YAML prod, test dùng profile `test`).
- Codex vòng 1: [P1] RUNBOOK gợi ý `SERVER_TOMCAT_REMOTEIP_INTERNAL_PROXIES=.*` → client giả `X-Forwarded-For` né rate limit; [P2] Cloudflare `Full` không xác thực origin. Đúng cả hai → dự phòng đổi thành biến `GOOGLE_REDIRECT_URI` (prod YAML, mặc định `{baseUrl}`), cấm `.*` trong RUNBOOK; Cloudflare để DNS only. Smoke lại: không đặt biến → `redirect_uri=https://api.example.test/…` (51,8 s); đặt biến → `https://api.fixed.test/…`.
- Codex vòng 2 (adversarial, phần sửa): approve, không có phát hiện.
### 2026-11-23 — Task 1: chia code frontend theo trang
- Người dùng nhận Task 1 (2026-11-23), chọn không sửa góp ý vòng 2.
- `App.tsx`: 58 trang qua `lazyPage` (`React.lazy` + export theo tên), `Suspense` quanh `Routes`, fallback `Skeleton`; `HomePage`, `AuthLayout` nạp ngay. Chunk `index-*.js` 1.873,40 kB (gzip 518,12) → 443,05 kB (gzip 139,03); lớn nhất khi vào trang chủ giờ là `index` (MarkdownContent 336 kB tách chunk riêng).
- Test: router chuyển trang trong transition nên URL đổi khi chunk trang đích nạp xong; vitest biên dịch module nguội ~5 s vượt `waitFor`. 6 file `App.*.test.tsx` thêm `import.meta.glob(pages, { eager: true })`; `findBy` ở 2 chỗ `App.auth`, 1 chỗ `Sidebar.test`; ca payment `App.courses` timeout 15 s (16 lần render, 5,5 s). Không đổi kỳ vọng. Lệch khác spec: timeout + glob nạp trước.
- Kiểm (`--no-file-parallelism`): 6 `App.*.test.tsx` + `layout/Sidebar` + `ui/{sidebar,labels,focus}` 202 đạt/4 lỗi; `npm run build` đạt; `tsc -b` đạt.
- Codex review vòng 1: [P2] lỗi tải chunk (deploy mới xóa chunk cũ, mất mạng) rơi vào màn lỗi mặc định của router. Đúng → `loadPage` tự tải lại trang một lần (cờ `sessionStorage` `techverse-chunk-reload`), lần lỗi kế tiếp liên tiếp thì ném lỗi. Test mới trong `App.moderator-courses.test.tsx`; chạy lại nhóm test liên quan 203 đạt/4 lỗi có sẵn; build đạt.
- Codex vòng 2 (adversarial): [P2] reload sẽ về trang nguồn vì URL chưa đổi. Claude phản biện: react-router 7.18.5 `completeNavigation` gọi `init.history.push` (dòng 1816) trước `updateState` (1847) → `window.location` đã là URL đích khi chunk lỗi; chỉ `useLocation` chậm. Không sửa, chờ người dùng quyết.
- Kiểm mắt (Playwright MCP, `vite preview` bản build, khách, desktop dark): trang chủ chỉ tải `index` + 4 chunk nhỏ; bấm menu sang `/courses` tải `CoursesPage-*.js`, h1 “Khóa học”. Chặn lần đầu chunk `ForumListPage` → tải lại đúng `/forum` một lần, h1 “Hỏi đáp”, cờ xóa (bác góp ý Codex vòng 2 bằng thực nghiệm). Chặn mãi chunk `PracticeListPage` → tải lại 1 lần rồi màn lỗi mặc định React Router, không lặp.
- Kiểm mắt lượt 2 (backend chạy, `vite preview` cổng 3000, context mới mỗi vai trò): khách/Author/Moderator/Admin đi hết link sidebar (50 lượt) + 11 route Author + chi tiết bài viết, khóa học + F5 `/author/courses` + mobile cảm ứng 390 sáng (menu sheet → Hỏi đáp, sheet đóng, không cuộn ngang): đủ h1 đúng, guard đúng, 0 lỗi JS, 0 màn lỗi router.
- 4 lỗi có sẵn trên `main` (mốc stash cùng phiên): 3 ca Google callback `App.auth` (“called 2 times, got 6”), 1 ca `App.author-courses` (“multiple links Khóa học”). Chạy song song file thì vài ca `App.*` chập chờn do tải.

### 2026-11-23 — Mở làn nhẹ deploy readiness
- Người dùng hỏi rủi ro khi deploy; chọn sửa tốc độ frontend + cấu hình tên miền/cookie, hosting cách A (Railway + tên miền riêng). Dashboard stats làm sau.
