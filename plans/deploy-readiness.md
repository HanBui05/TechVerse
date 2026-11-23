# Deploy readiness — brief làn nhẹ

Viết 2026-11-23 theo trao đổi với người dùng. **Không phải spec module**: hai task làn nhẹ, Claude làm, Codex review một lần, người dùng nhận. Không đổi nghiệp vụ (service, API, DB, luật xử lý).

## Mục tiêu (người dùng chốt 2026-11-23)

Demo trên internet ổn định, tải trang đủ nhanh, ít lỗi vặt. Không nhắm chạy nhiều server hay tải lớn.

## Quyết định người dùng

- **2026-11-23 — Hosting cách A:** mua tên miền; frontend ở `<tên-miền>` (Vercel hoặc Railway), backend ở `api.<tên-miền>` trên Railway (Custom Domain + bản ghi CNAME, HTTPS do Railway cấp). Không dùng VPS/nginx. Frontend và API cùng site nên cookie refresh `SameSite=Lax` giữ nguyên, không cần rewrite `/api`.

## Task 1 — Chia code frontend theo trang · Giao diện: Không

- Hiện trạng (build 2026-11-22): `index-*.js` 1,87 MB; `App.tsx` import thẳng 58 trang. `simple-icons` (5,3 MB) đã nạp lười và chỉ `pages/Admin/TaxonomyPage.tsx` dùng: không đụng.
- Làm: các trang trong `app/src/App.tsx` nạp bằng `React.lazy` + `Suspense` (fallback dùng component có sẵn, ví dụ `Skeleton`); giữ nguyên route, guard, layout. Không đổi bố cục nên không cần wireframe.
- Xong khi: chunk JS lớn nhất lúc vào trang chủ giảm rõ (ghi kích thước trước/sau từ `npm run build`); các `App*.test.tsx` đạt (chỉnh test chờ phần tử bằng `findBy…` nếu cần, không đổi kỳ vọng); `npm run build` đạt.

## Task 2 — Cấu hình triển khai · Giao diện: Không

- Làm khi người dùng đã mua tên miền. Đối chiếu code thật trước (tên biến web-url/CORS/OAuth trong `server/src/main/resources/application*.yaml`, `OAuth2Properties`).
- `application-prod.yaml`: Redis nhận mật khẩu/TLS qua biến môi trường (Railway Redis cần).
- `docs/RUNBOOK.md`: mục triển khai Railway — biến môi trường frontend (`VITE_API_BASE_URL=https://api.<tên-miền>`) và backend (web-url `https://<tên-miền>`, DB, Redis, khóa dịch vụ ngoài), Custom Domain + CNAME, redirect URI Google OAuth, WebSocket `wss://`, lưu ý gói free ngủ (khởi động lạnh).
- Xong khi: test/khởi động backend với profile prod không vỡ vì cấu hình mới (kiểm tĩnh nếu không chạy được), RUNBOOK đủ bước để người dùng tự deploy.

## Ngoài phạm vi

Nhiều server (WebSocket/AI registry trong bộ nhớ), thử tải, CI frontend (thuộc `ai-docs-optimization`), monitoring/sao lưu.
