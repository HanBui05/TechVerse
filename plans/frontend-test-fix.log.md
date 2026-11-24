# Nhật ký frontend test fix

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Làn nhẹ, không spec (người dùng mở 2026-11-24).

## Bắt đầu từ đây (cập nhật 2026-11-24)

- **Task tiếp:** (không có) — chờ merge PR #18 (`fix/frontend-tests` → `main`, mở 2026-11-24) · Giao diện: Không
- Task sửa 4 test đã nhận (2026-11-24), đã commit cục bộ trên `fix/frontend-tests`.

## Bốn ca lỗi (chạy lại 2026-11-24 trên nhánh `feature/dashboard-stats`, giống `main`)

Lệnh: `cd app && npx vitest run src/App.auth.test.tsx src/App.author-courses.test.tsx --no-file-parallelism` → 4 lỗi / 124 đạt.

1. `App.auth.test.tsx` › Google signup and login › ignores old account state and does not bootstrap a competing session on callback — `expected "vi.fn()" to be called 2 times, but got 6 times`.
2. Cùng nhóm › also suppresses old bootstrap for router-equivalent callback `/auth/callback/` — cùng lỗi.
3. Cùng nhóm › also suppresses old bootstrap for router-equivalent callback `/AUTH/CALLBACK` — cùng lỗi.
4. `App.author-courses.test.tsx` › opens the course workspace from the Author menu and the editor from “Tạo khóa học” — `Found multiple elements with the role "link" and name "Khóa học"`.

Lỗi có từ trước `deploy-readiness` (mốc stash ghi ở `plans/deploy-readiness.log.md`, Task 1). Ca 4 có thể do sidebar có hai link “Khóa học” (mục học viên + mục Tác giả).

## Quyết định người dùng chưa có trong spec

- 2026-11-24 — Mở task sửa 4 test frontend lỗi có sẵn; đóng module AI docs optimization (giữ phần đã làm).

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên

### 2026-11-24 — Sửa 4 test lỗi thời (chỉ test, code đúng)
- Ca 1–3: 4 lệnh gọi thêm là `conversations/socket-ticket` + `unread-count` (shell đã đăng nhập, nhân đôi do StrictMode), không phải bootstrap cạnh tranh → đếm riêng request `auth|users` như ca “completes a Google session”.
- Ca 4: menu chính (`/courses`) và nhóm Tác giả (`/author/courses`) cùng nhãn “Khóa học” (thiết kế hiện có, không đổi) → test chọn link theo `href`.
- `npx vitest run src/App.auth.test.tsx src/App.author-courses.test.tsx --no-file-parallelism` → 128/128 đạt; `npm run build` đạt.
- Codex review vòng 1: không phát hiện → không chạy vòng 2. Người dùng nhận task (2026-11-24).
