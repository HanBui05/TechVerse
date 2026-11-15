# Course payment — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-15)

- **Task tiếp:** Task 1d — Chính sách hoa hồng · Giao diện: Không
- Spec chốt 2026-11-14: Task 1a → 1b → 1c → 1d → cổng wireframe → 2a → 2b → 2c; **Task 1e (PayOS) hoãn**. Rủi ro cao: code bằng Opus, review vòng 1 `adversarial-review`.
- Task 1a, 1b, 1c đã nhận (2026-11-15), đã commit cục bộ trên `feature/course-payment` (1a: V13, giá, quyền xem; 1b: V14, đơn hàng, VietQR, báo chuyển khoản; 1c: V15, Admin xác nhận/đối chiếu, doanh thu tác giả).
- Bẫy cho 1b–1d: `TRUNCATE users CASCADE` trong test xóa luôn `commission_policies`; test cần policy phải tự `INSERT ... (rate_bps) VALUES (2000)`.
- Module đi kèm: [`course-ai-tutor.md`](course-ai-tutor.md) — Task 1 làm sau Task 1a. Người dùng cần chuẩn bị tài khoản nhận tiền cho `.env` trước khi thử thật.

## Quyết định người dùng chưa có trong spec

- (2026-11-15) Cho phép Claude push nhánh PR đang mở để gỡ CI; vẫn không push `main`, việc merge do người dùng làm.
- 7 quyết định ngày 2026-11-14 đã nằm trong thân spec, mục “Quyết định của người dùng”.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
### 2026-11-15 — Task 1c (Admin xác nhận, thanh toán trùng, doanh thu) — đã nhận (2026-11-15)
- File: V15 (audit `payment_transactions.confirmed_by/confirmation_source/confirmed_at`, `orders.needs_reconciliation/reconciled_by/reconciled_at`, trigger cấp quyền mới: khóa user, `NOT EXISTS` enrollment active, đơn đã PAID hoặc đã có quyền → bật cờ, giữ `paid_at` đầu); entity `PaymentTransaction` (chỉ đọc); `OrderService.confirm/reconcile/adminOrders/revenue`; endpoint trong `OrderController`; DTO `AdminOrderResponse`, `AuthorRevenueResponse`; 5 mã lỗi `PAYMENT_*`; security `GET /api/v1/author/revenue`.
- Test: `PaymentConfirmationIntegrationTest` (14, mới), `OrderIntegrationTest` (13), `OrderServiceTest` (3), `CourseLearningIntegrationTest` (6), `CoursePaymentMigrationTest`, `FreeCourseMigrationTest`, `ArticlePublicationMigrationTest`: 54 test, 0 lỗi. Lần đỏ: 500 do chưa có endpoint.
- Lệch khác spec: (1) V15 thay vì sửa V13. (2) Không tạo `PaymentConfirmationService`, `AdminOrderController`, `AuthorRevenueController`, các lớp `@WebMvcTest`/unit và `AuthorRevenueIntegrationTest` (luật ít class 2026-11-15): code vào `OrderService`/`OrderController`, mọi dòng bảng kiểm trong `PaymentConfirmationIntegrationTest`. (3) Lọc `code` khớp chính xác (không phân biệt hoa thường). (4) Body xác nhận đúng 2 trường; `amount` phải là số nguyên JSON (chuỗi/số thực → 400). (5) Kiểm trạng thái trước số tiền: đơn CANCELLED/FAILED → `PAYMENT_STATE_INVALID` dù tiền sai. (6) Admin thấy tên/email người mua và danh sách khoản đã xác nhận (để đối chiếu). (7) Doanh thu cần role AUTHOR (tác giả bị đình chỉ mất role → 403). (8) Reference trùng đơn khác do hai request song song: bắt unique index → 409 `PAYMENT_REFERENCE_CONFLICT`. (9) Đóng cờ cần body `{paymentCount}` (số khoản Admin đã xem); lệch → 409 `PAYMENT_RECONCILIATION_STALE` (mã mới), cờ giữ nguyên.
- Review vòng 1 (adversarial): [high] retry đóng cờ trễ có thể đóng cờ do khoản trùng mới mở lại → sửa bằng `paymentCount` (lệch 9); [medium] chưa test tranh reference giữa hai người mua → thêm `aReferenceCommittedConcurrentlyForAnotherBuyerIsAConflict` (giữ insert chưa commit, request chờ unique index rồi 409). `PaymentConfirmationIntegrationTest`: 15 test, 0 lỗi. Vòng 2: approve, không phát hiện.
### 2026-11-15 — Task 1b (đơn hàng, VietQR, báo đã chuyển khoản) — đã nhận (2026-11-15)
- File: V14 (`order_code_seq`, `orders.transfer_reported_at`), `CourseOrder`/`OrderItem` (chỉ đọc; ghi bằng native để trigger tính tổng/hoa hồng), `OrderRepository`, `service/impl/OrderService` (gồm rate limit Redis 5/phút chung tạo đơn + báo chuyển khoản, dựng VietQR), `OrderController`, `OrderResponse`, 7 mã lỗi, security, `vietqr.*` trong yaml/`.env.example`.
- Test: `OrderIntegrationTest` (12), `OrderServiceTest` (3), `CoursePaymentMigrationTest`, `FreeCourseMigrationTest`, `ArticlePublicationMigrationTest`, `PublishedCourseIntegrationTest`, `CourseLearningIntegrationTest`: 44 test, 0 lỗi. Chưa chạy full backend (CI).
- Lệch khác spec: (1) V14 thay vì sửa V13 (DB dev có thể đã áp V13). (2) Không tạo `OrderRateLimitService`/`OrderControllerTest` (luật ít class 2026-11-15); validation body kiểm trong `OrderIntegrationTest`. (3) Body phải đúng một trường `courseId` dạng UUID chuẩn, thừa trường (vd. `priceAmount`) → 400 `ORDER_INVALID`; JSON hỏng vẫn 400 `MALFORMED_REQUEST`. (4) Thiếu cấu hình VietQR chỉ chặn tạo đơn mới (503); đơn chờ đã có vẫn trả về, `vietQr` = null. (5) Mã đơn sai định dạng → 404 `ORDER_NOT_FOUND`. (6) Báo chuyển khoản chưa kiểm provider MANUAL (mọi đơn đều MANUAL khi 1e hoãn; ghi `shortcut:` trong code).
- Review vòng 1 (adversarial): `expireOverdue` dùng `now()` (giờ bắt đầu transaction) → request chờ khóa user qua hạn vẫn nhận đơn cũ. Sửa: `clock_timestamp()`; test `aRequestThatWaitsForTheUserLockPastTheDeadlineGetsANewOrder` đỏ với code cũ. `OrderIntegrationTest` + `OrderServiceTest`: 16 test, 0 lỗi. Vòng 2: approve, không phát hiện.
- Bẫy: `src/test/resources/application-test.yaml` che file cùng tên ở `src/main/resources` — cấu hình test đặt ở test resources.
### 2026-11-15 — Task 1a (V13, giá, quyền xem) — đã nhận (2026-11-15)
- Test: `CoursePaymentMigrationTest`, `CoursePriceServiceTest`, Author/Published/Learning/Moderator integration, `CourseContractTest`, `FreeCourseMigrationTest`, `CoursePersistence...`, `CourseLifecycleTest`, `ArticlePublicationMigrationTest`: 87 test, 0 lỗi. Chưa chạy full backend (CI).
- Lệch khác spec: (1) `priceAmount` vắng khi tạo = 0 (spec ghi “bắt buộc”) để client cũ không vỡ; PATCH có thì kiểm. (2) Sửa giá chỉ-giá được phép cả khi PENDING (giá ngoài kiểm duyệt), khóa loại giá vẫn áp. (3) Moderator dùng DTO riêng `ModeratorCourseResponse`/`ModeratorCourseSummaryResponse.Item` vì DTO cũ nhúng `CourseResponse` có tiền. (4) Khóa trả phí: khách/người học chưa mua đọc bài thường → 403 `COURSE_PURCHASE_REQUIRED` (chủ/Mod/Admin giữ `ACCESS_DENIED`). (5) `CourseContractTest` cho `MyCourseResponse` có tiền vì nhúng thẻ công khai. (6) Tác giả nhận `commissionRateBps` trong `CourseResponse` (đọc native `commission_policies`; 1d sẽ có entity).
- Review vòng 1: `updatedAt` trong review token làm đổi giá thành stale. Vòng 2: bỏ `updatedAt` thì token bị ABA (ẩn→khôi phục). Sửa cuối: giữ `updatedAt` trong token, đổi giá thuần dùng `CourseRepository.updatePrice` (JPQL, bỏ qua auditing) + trigger V13 `WHEN` bỏ qua update chỉ đổi `price_amount` nên `updated_at` đứng yên. Test `priceChangeAfterOpeningTheReviewDoesNotStaleTheToken` + `CoursePaymentMigrationTest`: 88 test, 0 lỗi. Chưa chạy vòng 3 (chính sách tối đa 2 vòng).
- V13: bỏ `ck_courses_free`, thêm `ck_courses_price`, seed 2000 bps, xóa `refunds` + 2 function (trigger/chỉ mục đi theo bảng).
### 2026-11-15 — Gỡ CI PR #4 (`course-free`)
- Lỗi: `AdminTopicIntegrationTest.inactivePreservesAllFourReferencingContentTypesWithoutChangingRows` chèn `courses.status`/`published_at` mà V12 đã xóa (`BadSqlGrammarException`, 589 test, 1 lỗi).
- Sửa: chèn khóa học DRAFT kèm `content_fingerprint`. `./gradlew test --tests 'AdminTopicIntegrationTest'`: 18/18 đạt.
- Commit `ffe2dc5` trên `feature/course-free`, push kèm 11 commit tài liệu chưa push (đều đã có trong nhánh này).
### 2026-11-14 — Chốt spec module khóa học
- Người dùng chốt `course-payment` và `course-ai-tutor` (“chốt như vậy với module khóa học”). Lịch sử phản biện chuyển sang `course-payment.review.md`.
- Đổi vai khâu Plan (D-030): Claude viết spec, Codex phản biện. `course-ai-tutor` chốt trước khi Codex phản biện.
- Claude đưa vào thân spec thanh toán: khoảng giá, hạn đơn 24 giờ, thanh toán trùng, nút “Tôi đã chuyển khoản” (endpoint + 3 dòng lỗi + copy + bộ lọc Admin), PayOS hoãn. Phần nút báo chuyển khoản chưa qua Codex soát.
- Chưa kiểm: spec còn vài dòng nhắc PAYOS (hạn 15 phút, ghi chú audit) — không áp dụng vì 1e hoãn.
