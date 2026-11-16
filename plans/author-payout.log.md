# Author payout — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-16)

- **Task tiếp:** Task 1b — Admin xem công nợ và ghi nhận khoản chi (Backend, rủi ro cao: Opus, review vòng 1 `adversarial-review`) · Giao diện: Không
- Task 1a đã nhận (2026-11-16).
- Sau 1b: 1c → 1d → cổng wireframe (người dùng duyệt) → 2a → 2b → 2c.
- Sau module này: module [`payos-checkout`](payos-checkout.md) (spec chốt 2026-11-16, thay Task 1e của `course-payment`). Repo chưa có cấu hình payOS/ngrok (kiểm 2026-11-16).
- Bẫy kế thừa: `TRUNCATE users CASCADE` trong test xóa luôn `commission_policies` và hai bảng mới; test cần policy phải tự `INSERT ... (rate_bps) VALUES (2000)`.
- Cho 1b: ghi chi phải khóa `users` của tác giả (`findByIdForAuthentication`) như `savePayoutAccount`; snapshot tài khoản đọc qua `OrderRepository.findPayoutAccount`.

## Quyết định người dùng chưa có trong spec

- (không có; các quyết định 2026-11-16 đã nằm trong spec)

## Câu hỏi mở cho người dùng

- (không có)

## Task 1a — Kết quả

- V17 không trùng: không nhánh cục bộ nào có V17+.
- Danh sách ngân hàng: 20 BIN lấy từ `https://api.vietqr.io/v2/banks` ngày 2026-11-16, hằng `OrderService.BANKS` (`{id, name}` = BIN + shortName).
- **Lệch khác spec:** không tạo entity `AuthorPayout`/`AuthorPayoutAccount` — đọc/ghi bằng native query + projection trong `OrderRepository` (như `CommissionPolicyRow`), `revenueTotals` đổi sang native để có subquery `author_payouts` trong cùng câu SQL. Body `PUT` còn từ chối ký tự điều khiển trong `accountName`. Thêm trigger `set_updated_at` cho `author_payout_accounts`. Matcher bảo mật thêm cả `GET /author/revenue/**` (cho 1c).
- Test: `./gradlew test` 7 lớp (`OrderServiceTest`, `CoursePaymentMigrationTest`, `AuthorPayoutIntegrationTest`, `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest`, `FreeCourseMigrationTest`, `ArticlePublicationMigrationTest`) — 64/64 đạt. Full backend do CI.
- Review: Codex `adversarial-review` vòng 1 — approve, không phát hiện; không chạy vòng 2.
- Chưa kiểm: frontend chưa dùng trường mới (Task 2a).

## Nhật ký phiên

### 2026-11-16 — Task 1a code
- V17 hai bảng + trigger bất biến; API `GET/PUT /author/payout-account`, `GET /author/payouts`; `revenue.totals` thêm `paidOutAmount`, `balanceAmount`.
- TDD: đỏ đúng lý do → xanh; 64 test đạt. Codex duyệt vòng 1. Task 1a đã nhận (2026-11-16).

### 2026-11-16 — Viết và chốt spec
- Claude viết spec, Codex phản biện một vòng (2 sai, 7 thiếu), Claude sửa thân spec; người dùng chốt, bỏ vòng 2.
