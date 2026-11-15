# Course payment — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-15)

- **Task tiếp:** Task 1b — Đơn hàng và VietQR (chỉ nhận tay, Admin xác nhận; không PayOS/tự động) · Giao diện: Không
- Spec chốt 2026-11-14: Task 1a → 1b → 1c → 1d → cổng wireframe → 2a → 2b → 2c; **Task 1e (PayOS) hoãn**. Rủi ro cao: code bằng Opus, review vòng 1 `adversarial-review`.
- Task 1a đã nhận (2026-11-15), đã commit cục bộ trên `feature/course-payment` (V13, giá/khóa loại giá, quyền xem khóa trả phí).
- Bẫy cho 1b–1d: `TRUNCATE users CASCADE` trong test xóa luôn `commission_policies`; test cần policy phải tự `INSERT ... (rate_bps) VALUES (2000)`.
- Module đi kèm: [`course-ai-tutor.md`](course-ai-tutor.md) — Task 1 làm sau Task 1a. Người dùng cần chuẩn bị tài khoản nhận tiền cho `.env` trước khi thử thật.

## Quyết định người dùng chưa có trong spec

- (2026-11-15) Cho phép Claude push nhánh PR đang mở để gỡ CI; vẫn không push `main`, việc merge do người dùng làm.
- 7 quyết định ngày 2026-11-14 đã nằm trong thân spec, mục “Quyết định của người dùng”.

## Câu hỏi mở cho người dùng

- (không có)

## Nhật ký phiên
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
