# Deploy readiness — brief làn nhẹ

Viết 2026-11-23 theo trao đổi với người dùng. **Không phải spec module**: hai task làn nhẹ, Claude làm, Codex review một lần, người dùng nhận. Không đổi nghiệp vụ (service, API, DB, luật xử lý).

## Mục tiêu (người dùng chốt 2026-11-23)

Demo trên internet ổn định, tải trang đủ nhanh, ít lỗi vặt. Không nhắm chạy nhiều server hay tải lớn.

## Quyết định người dùng

- **2026-11-23 — Hosting cách A:** mua tên miền; frontend ở `<tên-miền>` (Vercel hoặc Railway), backend ở `api.<tên-miền>` trên Railway (Custom Domain + bản ghi CNAME, HTTPS do Railway cấp). Không dùng VPS/nginx. Frontend và API cùng site nên cookie refresh `SameSite=Lax` giữ nguyên, không cần rewrite `/api`.
- **2026-11-23 — Dịch vụ và chi phí:** dùng Postgres và Redis của Railway, trial 30 ngày; theo dõi Usage và chuyển gói trả phí khi hết trial/credit. Không chạy 24/7: chỉ bật khi code/test và báo cáo môn học (1–2 giờ); dùng App Sleeping hoặc dừng/bật thủ công, lưu ý khởi động lạnh Spring Boot, deploy sát ngày báo cáo và giới hạn heap JVM vì trial có 1 GB RAM/dịch vụ.
- **2026-11-23 — Review Task 1:** không sửa góp ý vòng 2 về reload về trang nguồn, sau khi đối chiếu mã router và kiểm mắt; màn lỗi tiếng Việt khi chunk lỗi liên tục để task riêng nếu cần.

## Task 1 — Chia code frontend theo trang · Giao diện: Không

Đã nhận 2026-11-23: chia trang bằng `React.lazy` + `Suspense`, giữ route, guard và layout; lỗi tải chunk được thử reload một lần. Chi tiết và kết quả: [log Task 1](deploy-readiness.log.md). Test nạp trước trang bằng `import.meta.glob(..., { eager: true })` trong 6 file `App.*.test.tsx`, tăng timeout ca payment lên 15 giây và dùng `findBy` khi cần; không đổi kỳ vọng.

Xong khi:
- [x] Chunk JS lớn nhất lúc vào trang chủ giảm rõ: `index` 1.873,40 kB → 443,05 kB theo build ghi trong log.
- [ ] Các `App*.test.tsx` đạt: log ghi 4 lỗi có sẵn trên `main` (xem log).
- [x] `npm run build` đạt theo log.

## Task 2 — Cấu hình triển khai · Giao diện: Không

Đã nhận 2026-11-23; deploy thật theo [RUNBOOK](../docs/RUNBOOK.md) khi có tên miền. Cấu hình `prod` bổ sung Redis qua biến môi trường, Google OAuth + SendGrid, `server.port: ${SERVER_PORT:${PORT:8080}}`, `forward-headers-strategy: native` và `GOOGLE_REDIRECT_URI` tùy chọn (mặc định dùng `{baseUrl}`); chi tiết và kết quả: [log Task 2](deploy-readiness.log.md).

Xong khi:
- [x] Backend khởi động với profile `prod` và cấu hình mới trong kiểm thử cục bộ theo log.
- [x] RUNBOOK có các bước và biến môi trường để tự deploy Railway theo log.
- [ ] Kiểm SPA fallback (`RAILPACK_SPA_OUTPUT_DIR`) và dải IP proxy Railway tin cậy của Tomcat trên Railway thật (chưa kiểm — xem log).

## Ngoài phạm vi

Nhiều server (WebSocket/AI registry trong bộ nhớ), thử tải, CI frontend (thuộc `ai-docs-optimization`), monitoring/sao lưu.
