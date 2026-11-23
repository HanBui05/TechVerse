# Nhật ký dashboard stats

Trạng thái chính thức: xem [`PLAN.md`](PLAN.md). Spec: [`dashboard-stats.md`](dashboard-stats.md).

## Bắt đầu từ đây (cập nhật 2026-11-23)

- **Task tiếp:** viết wireframe Task 2 (cổng 2026-11-16 thắng câu “không làm wireframe” của spec) · Giao diện: Có
- Task 1 đã nhận (2026-11-23).
- Nhánh `feature/dashboard-stats` (từ `main`), Task 1 đã commit cục bộ, chưa push.

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên

### 2026-11-23 — Task 1: API số liệu
- Người dùng nhận Task 1 (2026-11-23).
- `GET /api/v1/admin/dashboard`, `GET /api/v1/moderator/dashboard`: `DashboardController`, `DashboardService` (kiểm vai trò + tài khoản hoạt động như `ModeratorArticleServiceImpl.checkModerator`; số `null` → 0; vượt 2^53−1 → `IllegalStateException` → 500 `INTERNAL_ERROR` có log), `DashboardRepository` (JdbcTemplate, mỗi endpoint một câu SQL gồm các câu đếm con, `now()` lấy một lần), `DashboardResponse` (record `Admin`/`Moderator` riêng); `SecurityConfiguration` thêm matcher GET `/api/v1/moderator/dashboard`.
- Điều kiện lấy từ code nguồn: hàng đợi bài viết/khóa học = `workflow_status = PENDING` và `publication_status <> AUTHOR_DELETED`; bài tập/phỏng vấn = `status = PENDING`; đơn chờ xác nhận = `transfer_reported_at IS NOT NULL` và `PENDING`/`EXPIRED` (như `OrderRepository.findForAdmin`).
- Lệch khác spec: mọi phần nguồn đã có trong code nên không có khóa nào bị bỏ, không viết logic bỏ nhóm (và không có ca test cho nó). `SUM` rỗng quy về 0 ở service. Giao dịch thứ hai của đơn `PAID` bị trigger V15 bật cờ đối chiếu — test ghi nhận, không phải lỗi.
- Kiểm: `./gradlew test --tests 'com.techverse.server.dashboard.*'` → Controller 3/3, Service 4/4, Integration 4/4 đạt. Không chạy full backend (CI khi mở PR).
- Codex vòng 1: [P2] khoảng 7/30 ngày thiếu cận trên → bản ghi có mốc tương lai bị tính. Đúng → thêm `<= now()` cho `users.created_at` và `orders.paid_at`; test thêm người dùng và đơn `PAID` có mốc +1 giờ (chỉ tính ở tổng). Chạy lại cùng lệnh: 11/11 đạt.
- Codex vòng 2 (adversarial, phần sửa): approve, không có phát hiện.
