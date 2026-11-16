# PayOS checkout — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-16)

- **Task tiếp:** Task 1b — Xác nhận thanh toán: tra cứu và webhook (rủi ro cao, dùng Opus) · Giao diện: Không
- Task 1a đã nhận (2026-11-16); commit cục bộ trên nhánh `feature/payos-checkout` (tách từ `feature/author-payout`).
- Để trống `PAYOS_*` tới khi xong 1b: đơn PAYOS chưa tự chuyển PAID, Admin không xác nhận tay được.
- Chưa thử payOS thật (cần tài khoản payOS + ngrok của người dùng): payOS có từ chối tạo trùng số đơn không, khoảng `orderCode`, số tiền tối thiểu — kiểm trước khi bật (quyết định 5 của spec).
- Sau 1a: 1b → cổng wireframe → 2.

## Quyết định người dùng chưa có trong spec

- (không có)

## Câu hỏi mở cho người dùng

- (không có)

## Task 1a — Kết quả

- Mới: `V18__payos_checkout.sql`, `PayosClient` (tra cứu/tạo link, ký HMAC, cắt mỗi lời gọi ở 10 giây bằng `sendAsync().get(timeout)` + hủy), `PayosClientTest` (6), `PayosIntegrationTest` (5). Sửa: `CourseOrder` (2 cột + `provider` bằng `@Formula` từ dòng giao dịch), `OrderRepository` (`insertOrder` theo phút, `insertTransaction(provider)`, `claimPayosLink`, `savePayosLink`), `OrderService` (`create`/`detail` bỏ `@Transactional`, dùng `TransactionTemplate`; `withPayosLink`; báo chuyển khoản đơn PAYOS → 409), `OrderResponse` (+`provider`, `checkoutUrl`, `amountPaid`), `application.yaml`, `.env.example`, `CoursePaymentMigrationTest` (+1 ca), `OrderServiceTest` (constructor).
- Kiểm: `./gradlew test --tests PayosClientTest --tests PayosIntegrationTest --tests CoursePaymentMigrationTest --tests OrderServiceTest --tests OrderIntegrationTest --tests PaymentConfirmationIntegrationTest --tests AuthorPayoutIntegrationTest` → 73/73 đạt. Grep đầu task: không test nào khẳng định phiên bản Flyway mới nhất.
- **Lệch khác spec:** (1) ca “payOS bật/tắt theo từng cấu hình thiếu, URL sai dạng” nằm ở `PayosClientTest` (cấu hình thuộc `PayosClient`), không ở `OrderServiceTest`. (2) “lời gọi payOS bị cắt ở 10 giây” kiểm ở `PayosClientTest` (mặc định 10 giây + cắt thật với timeout 50 ms), không chờ 10 giây trong test tích hợp. (3) Tra cứu: HTTP 200 với `code` ≠ `"00"` coi là “chưa có link”; tạo bị từ chối với **mọi** mã lỗi (không chỉ “đơn đã tồn tại”, vì mã chưa xác minh) → tra cứu lại, vẫn không có thì lỗi. (4) `PayosIntegrationTest` có `@MockitoSpyBean PayosClient` riêng → thêm một Spring context (đặt ở lớp cơ sở sẽ tách context khỏi `AuthorArticleIntegrationTest`, ngoài phạm vi). (5) Kiểm chữ ký webhook để Task 1b.
- Bẫy: open-in-view giữ một EntityManager suốt request → hai câu cập nhật native mới phải `clearAutomatically`, nếu không lần đọc lại trả entity cũ (không có link).

## Nhật ký phiên
### 2026-11-16 — Task 1a đã nhận
- Người dùng nhận Task 1a (2026-11-16); tách nhánh `feature/payos-checkout`, commit cục bộ.

### 2026-11-16 — Task 1a Codex vòng 1 + sửa
- Vòng 1 (`adversarial-review`): 1 phát hiện high — tra cứu nhận link dù `amount` khác tổng đơn. Đúng; sửa `PayosClient.find(orderNo, amount)` đối chiếu số tiền, thêm 2 ca (`amount` khác, thiếu `amount`) vào `PayosClientTest`.
- Kiểm lại: `PayosClientTest` 6/6, `PayosIntegrationTest` 5/5. Vòng 2 (chỉ phần sửa): approve, không phát hiện.
### 2026-11-16 — Task 1a code xong
- Đổi `PLAN.md` sang module này; viết test trước (đỏ vì thiếu `PayosClient`), code tới xanh; chi tiết ở “Task 1a — Kết quả”.
