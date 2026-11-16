# Course payment

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Tác giả đặt giá, người học mua từng khóa bằng chuyển khoản ngân hàng và được cấp quyền; nền tảng lưu hoa hồng, tác giả xem doanh thu. Bước đầu Admin đối chiếu VietQR; PayOS webhook tự xác nhận là task Backend cuối có thể cắt.
**Làn:** Đầy đủ · **Rủi ro cao:** tiền, đồng thời, webhook công khai; review vòng 1 dùng `adversarial-review`.
**Thứ tự:** 1a → 1b → 1c → 1d → cổng wireframe → 2a → 2b → 2c. **Task 1e (PayOS) hoãn** (người dùng 2026-11-14): không code, không test, không thêm cấu hình/secret PayOS trong module này; thanh toán chỉ có VietQR + Admin xác nhận. Mọi câu “nếu 1e được giữ” bên dưới coi như không áp dụng. Mỗi task dự kiến nửa ngày đến một ngày; trễ quá một ngày báo người dùng để cắt. Backend đã chọn phải xong và review trước wireframe/giao diện; nếu cắt 1e, giao diện chỉ mở VietQR.

## Đường dẫn thuộc module

Chỉ sửa các đường dẫn sau; file mới đặt theo kiến trúc hiện có. Test mới nằm cạnh test miền tương ứng.

- `server/src/main/resources/db/migration/V13__course_payment.sql` và migration thanh toán V14–V16, `server/src/main/resources/application*.yaml`, `.env.example`.
- `server/src/main/java/com/techverse/server/{controller,entity,enums,dto,repository,service,properties}/**/*{Course,Lesson,Order,Payment,Commission,Revenue,Payos,Vietqr}*.java`; `server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java`, `server/src/main/java/com/techverse/server/exception/ErrorCode.java`; `service/impl/OrderRateLimitService.java` riêng cho đơn.
- `server/src/test/java/com/techverse/server/{course,payment}/**/*.java` (kể cả lớp mới và `CourseIntegrationTestBase`); `server/src/test/java/com/techverse/server/article/ArticlePublicationMigrationTest.java` nếu assertion phiên bản Flyway cần sửa.
- `plans/course-payment.wireframe.md` (tạo ở cổng wireframe); `app/src/{App.tsx,App.*.test.tsx,StaffPreferences.test.tsx}`, `app/src/{types,services,data}/*{course,Course,payment,Payment,order,Order,commission,Commission,revenue,Revenue,navigation}*`, `app/src/services/returnTo.ts`, `app/src/pages/Login/**`, `app/src/components/layout/{Sidebar,AdminSidebar}.tsx` và test trực tiếp.
- `app/src/pages/{Courses,Author/Courses,Author/Revenue,Admin/Orders,Admin/Commission,Payments}/**` và test; `app/src/components/ui/{sidebar,labels,focus}*.test.*` khi sửa shell.

## Ngoài phạm vi

- Đăng ký bán, điều khoản bán nhiều phiên bản, thông tin chi trả tác giả, sổ tiền và chi trả; giỏ hàng, giảm giá, hoàn tiền, Admin cấp tặng hoặc thu hồi quyền.
- PayOS và mọi cách tự xác nhận qua webhook (Task 1e hoãn 2026-11-14, module sau); trang return/cancel của cổng thanh toán.
- Người học tự hủy đơn chờ (E2, không làm); xuất CSV đơn đã trả (E3, tách sau); xử lý tiền chuyển thừa/trùng trong sản phẩm (Admin xử lý ngoài hệ thống).
- VNPay, tiền mặt, trang cổng giả lập cho người dùng, gọi VietQR/PayOS thật trong test; lưu bí mật hoặc thông tin ngân hàng vào frontend cấu hình cứng.
- Thay provider video, bảo vệ link YouTube khỏi người đã mua chia sẻ; thời lượng, AI tutor và chức năng khóa học khác.

## Ràng buộc chung

- Đổi API/DB: Có, migration mới V13–V16; không sửa V1–V12. Giữ contract `ApiResponse`/`ErrorResponse` và hành vi khóa miễn phí. Không sửa `final.sql` trong module này.
- Giá nguyên VND: 0 (miễn phí) hoặc 10.000–50.000.000 (người dùng chốt 2026-11-14); kiểm cả service và CHECK trong V13. Chưa xác minh giới hạn số tiền của PayOS: 1e kiểm lại trước khi bật. Giá và nội dung chuyển khoản lấy từ DB/cấu hình. Hạn đơn MANUAL 24 giờ, PAYOS 15 phút (chốt 2026-11-14); hạn chỉ quyết định trả đơn cũ hay tạo đơn mới, tiền đến sau hạn vẫn được xác nhận. Giá và policy snapshot khi tạo đơn.
- Giá nằm trên `courses`, ngoài snapshot duyệt; đổi giá dương có hiệu lực ngay cho đơn mới. Khóa từng công khai (`published_version_id IS NOT NULL`) không đổi loại 0 ↔ dương kể cả sau ẩn/gỡ; kiểm trong transaction cùng khóa dòng course khi sửa và công khai. Moderator không nhận giá, doanh thu, thông tin ngân hàng từ API quản lý hoặc giao diện.
- Guest xem tổng quan và bài học thử; người chưa có enrollment active không nhận nội dung/video bài thường và không tạo FREE enrollment cho khóa trả phí. Người mua/đã có enrollment active học bình thường. Owner không mua khóa mình; ADMIN/MODERATOR không mua/học theo luật `course-free`.
- Cấu hình tài khoản nhận và secret chỉ ở backend `.env`, mẫu để trống; không log secret/chữ ký. VietQR dựng URL ảnh từ tham số backend, encode query; không gọi dịch vụ khi test. Khi dùng QR thật, trình duyệt liên hệ VietQR và chịu giới hạn 10 ảnh/10 giây/IP theo tài liệu.
- Đối chiếu thật do Admin chịu trách nhiệm: xác nhận chỉ sau khi kiểm sao kê, mã đơn và số tiền. Không có hoàn tiền; hiển thị trước khi mua. PayOS chỉ webhook đã kiểm chữ ký được xác nhận; return/cancel trình duyệt chỉ hiển thị, không cấp quyền.
- Nguồn tham khảo và thứ tự ưu tiên: [`course-payment.directions.md`](course-payment.directions.md) mục 8–9; mục 8 thắng hướng cũ. Năm quyết định ngày 2026-11-14 ở mục “Quyết định của người dùng” đã được đưa vào thân spec.

## Task 1a — Schema, giá và quyền xem

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- V13 thay `ck_courses_free`, seed policy chung 2000 bps có hiệu lực ngay; xóa `refunds`, hai trigger/function liên quan và loại khỏi danh sách audit được tạo động nếu cần, không sửa V1. Test migration từ V1–V13 và trên DB rỗng.
- Tác giả APPROVED sở hữu khóa đặt/sửa giá; API public list/detail trả giá và VND; API Author trả giá và policy hiện tại để tính phần nhận. Moderator DTO/query không chứa trường tiền. `CourseContractTest` cho phép tiền ở `CourseWriteRequest`, `CourseResponse`, `CourseSummaryResponse`, `PublishedCourseSummaryResponse`, `PublishedCourseDetailResponse` và `MyCourseResponse`; DTO Moderator không có tiền; giữ kiểm video URL.
- Điều chỉnh start, đọc bài và tiến độ theo ràng buộc chung; không lộ payload bài thường qua API khác. Giá có hiệu lực độc lập kiểm duyệt nội dung.

- Khi tạo khóa, thiếu `priceAmount` mặc định 0; sửa chỉ giá được phép cả khi PENDING, vẫn khóa đổi loại giá. `CourseResponse` của Author có `commissionRateBps`; `MyCourseResponse` có tiền do nhúng thẻ công khai. Moderator dùng `ModeratorCourseResponse` và `ModeratorCourseSummaryResponse.Item` riêng. Khách/người học chưa mua đọc bài thường nhận 403 `COURSE_PURCHASE_REQUIRED`; chủ khóa/Admin/Moderator giữ `ACCESS_DENIED`. Review token giữ `updatedAt`; sửa thuần giá không cập nhật `updated_at` (JPQL và trigger V13), tránh stale token và ABA.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `priceAmount` | Khi tạo nếu vắng thì mặc định 0; khi cung cấp phải là số nguyên VND: 0 hoặc 10.000–50.000.000 (biên 9.999 và 50.000.001 bị từ chối) | 400 `COURSE_PRICE_INVALID` | Giá khóa học không hợp lệ. |
| Người sửa giá | Chưa đăng nhập / không APPROVED / không sở hữu | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` / 404 `COURSE_NOT_FOUND` | Đăng nhập / không có quyền. / Không tìm thấy khóa học. |
| Khóa từng công khai | Không đổi miễn phí ↔ trả phí, kể cả request sửa/công khai đồng thời | 409 `COURSE_PRICE_TYPE_LOCKED` | Không thể đổi loại giá của khóa đã công khai. |
| Khóa/bài không tồn tại hoặc không công khai | Không để lộ nội dung | 404 `COURSE_NOT_FOUND` / `LESSON_NOT_FOUND` | Không tìm thấy khóa học / bài học. |
| Bài thường/start khóa trả phí chưa có quyền | Không tạo FREE enrollment, không trả video/nội dung | 403 `COURSE_PURCHASE_REQUIRED` | Hãy mua khóa học để tiếp tục. |
| Chủ khóa hoặc ADMIN/MODERATOR start/progress | Giữ luật hiện tại | 403 `ACCESS_DENIED` | Bạn không có quyền. |

### Kế hoạch thực thi

- **File:** V13; `Course`, `CourseWriteRequest`, DTO/service/controller Author, public, access và repository; migration/contract/learning test.
- **Dùng lại:** snapshot/preview và enrollment `course-free`; trigger V1; lỗi/quyền hiện hành.
- **Bẫy:** `char(3)` với Hibernate validate; khóa dòng khi đổi giá/công khai; `refunds` xuất hiện trong khối tạo audit V1, không sửa migration cũ.

### Xong khi

- [x] Migration, giá/quyền, nội dung và regression: các lớp liên quan đạt; xem [log Task 1a](course-payment.log.md).
- [ ] Full backend do CI chạy khi mở PR (chưa kiểm — xem log).

## Task 1b — Đơn hàng và VietQR

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `POST /api/v1/orders {courseId}`, `GET /api/v1/me/orders`, `GET /api/v1/orders/{orderCode}`: mỗi đơn một khóa; chủ đơn xem QR khi chờ/hết hạn để đối chiếu; danh sách phân trang. Trả mã, snapshot tên/giá, trạng thái, thời hạn, tham số VietQR; không trả secret.
- Sinh mã `TV` + 12 chữ số từ sequence duy nhất, ASCII, không tái sử dụng; vừa nội dung chuyển khoản ≤50 ký tự vừa không lộ UUID. Đơn PENDING quá hạn theo provider đánh EXPIRED khi đọc/tạo đơn; không scheduler. Request mới sau hết hạn tạo đơn mới.
- Trong transaction khóa dòng user trước kiểm enrollment và đơn chờ cùng khóa; trả lại đơn PENDING còn hạn cho các request đồng thời. Public detail không trả đơn chờ: nút Mua gọi POST rồi mở đơn được trả về. Chụp giá và policy đang hiệu lực tại thời điểm tạo item; tạo order tổng 0 → insert item → đọc tổng trigger → tạo transaction MANUAL PENDING.
- **Báo đã chuyển khoản (E1, người dùng chọn 2026-11-14):** `POST /api/v1/orders/{orderCode}/transfer-report` (không body) cho chủ đơn MANUAL đang PENDING hoặc EXPIRED: ghi `orders.transfer_reported_at` (cột mới V14) lần đầu, gọi lại giữ nguyên thời điểm cũ và trả 200. Cờ **không** đổi trạng thái đơn, không cấp quyền, không thay việc Admin đối chiếu sao kê; chỉ để Admin lọc (1c). DTO đơn của chủ đơn và của Admin trả `transferReportedAt`. Dùng chung giới hạn 5 request/phút/user với tạo đơn.

- V14 thêm sequence và `transfer_reported_at`; nghiệp vụ, rate limit và validation nằm trong `OrderService`/`OrderController`, không tạo `OrderRateLimitService` hay `OrderControllerTest`. Mã đơn sai định dạng trả 404 `ORDER_NOT_FOUND`. Báo chuyển khoản chưa kiểm provider MANUAL vì hiện mọi đơn đều MANUAL; cần bổ sung khi mở provider khác. Hạn được kiểm bằng `clock_timestamp()` sau khi chờ khóa.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `courseId` | Body đúng một trường UUID chuẩn, thừa trường hoặc UUID sai: `ORDER_INVALID`; JSON hỏng: `MALFORMED_REQUEST` | 400 `ORDER_INVALID` / `MALFORMED_REQUEST` | Thông tin đơn hàng không hợp lệ. |
| Đăng nhập, role, chủ đơn/khóa | Guest / ADMIN, MODERATOR, chủ khóa / xem đơn người khác | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` / 404 `ORDER_NOT_FOUND` | Đăng nhập / không có quyền / không tìm thấy đơn. |
| Khóa không tồn tại, không công khai, miễn phí | Chỉ bán khóa công khai có giá dương | 404 `COURSE_NOT_FOUND` / 409 `ORDER_COURSE_UNAVAILABLE` | Không tìm thấy khóa / không thể mua. |
| Đã có enrollment active | Không tạo đơn mới | 409 `ORDER_ALREADY_ENROLLED` | Bạn đã có quyền học khóa này. |
| Đơn còn hạn / tạo đồng thời | Cùng user, khóa: trả cùng đơn, không nhân bản | 200 `OK` | Tiếp tục thanh toán đơn đang chờ. |
| Đơn hết hạn | Giữ lịch sử, tạo đơn mới; tiền về sau vẫn xử lý theo 1c | 200 `OK` | Đơn đã hết hạn; liên hệ Admin nếu đã chuyển khoản. |
| Cấu hình ngân hàng thiếu/sai, policy không hiệu lực | Không tạo đơn mới không thể thanh toán; đơn chờ có sẵn vẫn trả về, `vietQr` có thể null | 503 `PAYMENT_UNAVAILABLE` | Thanh toán tạm thời không khả dụng. |
| Tạo quá nhanh | Tối đa 5 request/phút/user, kể cả retry | 429 `ORDER_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |
| Báo đã chuyển khoản: thành công / gọi lại | Chủ đơn, đơn MANUAL PENDING hoặc EXPIRED; lần sau không đổi thời điểm | 200 `OK` | Đã báo cho Admin; quyền học được mở sau khi Admin đối chiếu. |
| Báo đã chuyển khoản: đơn người khác / không có | Không tiết lộ đơn | 404 `ORDER_NOT_FOUND` | Không tìm thấy đơn. |
| Báo đã chuyển khoản: đơn đã PAID, FAILED hoặc CANCELLED | Không ghi cờ | 409 `ORDER_TRANSFER_REPORT_NOT_ALLOWED` | Đơn này không cần báo chuyển khoản. |

### Kế hoạch thực thi

- **File:** order/payment DTO, service, repository, controller, cấu hình VietQR; security authenticated cho `POST /api/v1/orders`, `GET /api/v1/orders/*`, `GET /api/v1/me/orders`; V14 thêm sequence/index thực sự cần.
- **Dùng lại:** trigger `refresh_order_total`, `calculate_order_item_revenue`; rate limit riêng theo mẫu hiện có, không sửa `ArticleRateLimitService`.
- **Bẫy:** flush/đọc lại tổng sau trigger; policy và thay đổi giá phải khóa/đọc nhất quán; không giữ DB lock trong khi gọi dịch vụ ngoài.

### Xong khi

- [x] Đơn, VietQR, validation, quyền, hết hạn, đồng thời và regression: `OrderServiceTest`, `OrderIntegrationTest` và các lớp liên quan đạt; xem [log Task 1b](course-payment.log.md).
- [ ] Full backend do CI chạy khi mở PR (chưa kiểm — xem log).

## Task 1c — Admin xác nhận, đồng thời và doanh thu

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/admin/orders` lọc trạng thái/mã, `transferReported=true|false` (đơn người học đã báo chuyển khoản, 1b) và `needsReconciliation=true|false`, phân trang; `POST /api/v1/admin/orders/{orderCode}/confirm` nhận `amount` nguyên và `bankReference` bắt buộc 1–255 ký tự đã trim, Admin nhập từ sao kê. `GET /api/v1/author/revenue` chỉ tổng và danh sách item PAID của khóa thuộc tác giả hiện tại, gồm giá, tỷ lệ, phần nền tảng và phần tác giả, phân trang; không chứa thông tin người mua.
- Hàm xác nhận chung: khóa user rồi order/transaction theo thứ tự cố định; so sánh amount với snapshot, kiểm reference duy nhất và trạng thái; ghi audit người xác nhận, thời điểm và reference, cập nhật transaction SUCCEEDED để trigger đặt PAID/cấp quyền trong cùng transaction. PENDING hoặc EXPIRED đều được xác nhận. Admin chỉ xác nhận đơn MANUAL; không xác nhận hộ PayOS.
- **Thanh toán trùng (chốt 2026-11-14):** nếu đơn cũ thanh toán sau khi đơn khác đã cấp quyền, ghi PAID và reference cho từng khoản thật, giữ một enrollment active và cảnh báo Admin đối chiếu. V15 sửa trigger dùng `INSERT … SELECT … WHERE NOT EXISTS` enrollment active, vẫn xử lý conflict `order_item_id`, tuần tự hóa theo user; không mở chức năng revoke.
- Retry cùng đơn/reference/số tiền trả kết quả cũ; reference đã dùng cho đơn khác báo xung đột. Reference mới cùng đơn PAID, đúng tiền: ghi transaction SUCCEEDED mới, bật cờ đối chiếu, không nhân doanh thu/item hay quyền (chốt 2026-11-14). Tiền thừa do Admin xử lý ngoài hệ thống; không hoàn tiền trong sản phẩm. Sai số tiền không đánh FAILED hoặc cấp quyền.
- Audit: `payment_transactions.confirmed_by` nullable (MANUAL là Admin, PAYOS null), `confirmation_source`, `confirmed_at`; `orders` lưu cờ đối chiếu và người/thời điểm đóng. Admin gọi `POST /api/v1/admin/orders/{orderCode}/reconcile` để đóng cờ; khoản bất thường mới mở lại cờ, không sửa giao dịch/quyền.

- V15 thêm audit/cờ và sửa trigger; dùng `OrderService`/`OrderController`, kiểm trong `PaymentConfirmationIntegrationTest`, không tạo các lớp service/controller/test riêng từng chức năng. Lọc mã đơn khớp chính xác, không phân biệt hoa thường; Admin thấy tên/email người mua và danh sách khoản đã xác nhận. Doanh thu yêu cầu role AUTHOR, mất role do đình chỉ nhận 403. Reference trùng giữa hai đơn kể cả request đồng thời trả 409 `PAYMENT_REFERENCE_CONFLICT`; đóng cờ dùng `paymentCount` để tránh đóng nhầm khi có khoản mới.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `amount`, `bankReference` | Body đúng hai trường; `amount` là số nguyên JSON dương, reference trim 1–255 ký tự | 400 `PAYMENT_INVALID` | Thông tin đối chiếu không hợp lệ. |
| Guest / không phải Admin, không phải Author | Theo role và trạng thái tác giả; doanh thu chỉ của mình | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` | Đăng nhập / không có quyền. |
| Không có đơn | Không tiết lộ dữ liệu khác | 404 `ORDER_NOT_FOUND` | Không tìm thấy đơn. |
| Sai số tiền | So với tổng snapshot, không thay trạng thái | 409 `PAYMENT_AMOUNT_MISMATCH` | Số tiền không khớp đơn; hãy đối chiếu sao kê. |
| Đơn sai provider/trạng thái | Chỉ MANUAL PENDING/EXPIRED hoặc PAID hợp lệ; CANCELLED/FAILED kiểm trước số tiền | 409 `PAYMENT_STATE_INVALID` | Không thể xác nhận đơn ở trạng thái này. |
| Reference trùng đơn khác | Không gán cùng giao dịch cho hai đơn | 409 `PAYMENT_REFERENCE_CONFLICT` | Mã giao dịch đã được dùng hoặc không khớp. |
| Reference mới cùng đơn PAID | Ghi khoản đúng tiền, bật cờ đối chiếu, không nhân doanh thu/quyền | 200 `OK` | Đã ghi nhận; cần đối chiếu khoản trùng. |
| Đóng cờ đối chiếu | Admin gửi `{paymentCount}` là số khoản đã xem; lệch thì giữ cờ, retry trả kết quả cũ | 200 `OK` / 409 `PAYMENT_RECONCILIATION_STALE` / `PAYMENT_RECONCILIATION_NOT_REQUIRED` / 404 `ORDER_NOT_FOUND` | Đã đối chiếu / Dữ liệu đã thay đổi, hãy tải lại / Không có khoản cần đối chiếu / Không tìm thấy đơn. |
| Retry đúng, xác nhận song song | Một lần chuyển trạng thái; trả kết quả cũ | 200 `OK` | Đã ghi nhận thanh toán. |
| Đơn hết hạn hoặc đã có enrollment từ đơn khác | Ghi nhận tiền thật; chỉ một quyền active, cảnh báo đối chiếu khoản trùng | 200 `OK` | Đã ghi nhận; cần đối chiếu nếu có khoản thanh toán trùng. |

### Kế hoạch thực thi

- **File:** order controller, DTO, service, repository; security authenticated cho `GET /api/v1/author/revenue`, `/api/v1/admin/**` đã authenticated, service kiểm role; V15 bổ sung audit/cờ và sửa trigger cấp quyền; test payment.
- **Dùng lại:** trigger xác thực tổng, tính hoa hồng và cấp quyền; hàm xác nhận dùng tiếp ở 1e.
- **Bẫy:** unique `(user, course)` active không được `ON CONFLICT (order_item_id)` che; JPA cache cũ sau trigger; khóa theo user để tuần tự hóa cả hai đơn khác nhau.

### Xong khi

- [x] Xác nhận, đối chiếu, doanh thu, quyền và regression: `PaymentConfirmationIntegrationTest` và các lớp liên quan đạt; xem [log Task 1c](course-payment.log.md).

## Task 1d — Chính sách hoa hồng

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/admin/commission-policy`, `PUT /api/v1/admin/commission-policy {rateBps}`; Admin đổi tỷ lệ chung, hiệu lực ngay tại thời điểm server ghi, tạo policy mới có `effective_from`, đóng policy cũ và giữ lịch sử. Không đặt lịch tương lai trong phạm vi này. Author đọc tỷ lệ hiệu lực qua API Task 1a; đơn cũ không tính lại.
- Cả đổi policy và tạo item lấy cùng PostgreSQL advisory transaction lock cố định trước khi đọc policy active, đọc lại sau khi lấy khóa và giữ đến commit; mỗi đơn nhận policy hiệu lực tại thời điểm tạo item. Giới hạn 0–10000 bps, số nguyên. Phần tác giả = giá − floor(giá × bps / 10000).

- V16 bảo vệ policy và snapshot item; cập nhật trực tiếp snapshot bị DB từ chối. Dùng `OrderService`/`OrderController`/`OrderRepository`, kiểm trong `PaymentConfirmationIntegrationTest`, không tạo các lớp CommissionPolicy riêng. Test đổi tỷ lệ đóng policy cũ rồi tạo mới. Thời điểm tạo order/item dùng `clock_timestamp()` sau khóa để không sớm hơn policy mới.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `rateBps` | Body chỉ gồm `rateBps` là số nguyên JSON 0–10000; từ chối chuỗi, số thực và trường thừa | 400 `COMMISSION_RATE_INVALID` | Tỷ lệ không hợp lệ. |
| Guest / không phải Admin | Chỉ Admin đọc/đổi policy quản trị | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` | Đăng nhập / không có quyền. |
| Đổi trùng tỷ lệ | Trả policy hiện tại, không tạo bản mới | 200 `OK` | Tỷ lệ hiện tại không đổi. |
| Đổi đồng thời / đồng thời tạo đơn | Tuần tự hóa; một policy active, snapshot nhất quán | 200 `OK` | Đã cập nhật tỷ lệ. |
| Không có policy hợp lệ (tạo đơn) | Không tạo đơn | 503 `PAYMENT_UNAVAILABLE` | Thanh toán tạm thời không khả dụng. |
| Không có policy hợp lệ (Admin đọc policy) | GET policy trả `data: null` | 200 `OK` | Chưa có tỷ lệ hoa hồng. |
| Không có policy hợp lệ (Admin đổi policy) | PUT tạo policy đầu tiên | 200 `OK` | Đã cập nhật tỷ lệ. |

### Kế hoạch thực thi

- **File:** `Order` controller/service/repository, DTO và V16.
- **Dùng lại:** unique active policy và trigger V1; V16 chặn đổi `rate_bps` policy đã tạo, cho đóng `effective_to`/`is_active`; chặn sửa giá, policy, tỷ lệ và số tiền snapshot item sau insert, cho cập nhật hợp lệ khác. Đọc lại giá trị trigger.
- **Bẫy:** unique chỉ cho một active; đóng và tạo mới nguyên tử; tránh timestamp trùng làm sai `effective_to > effective_from`.

### Xong khi

- [x] Policy, đồng thời, snapshot và regression: `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest` và các lớp liên quan đạt; xem [log Task 1d](course-payment.log.md).

## Task 1e — PayOS webhook — HOÃN (người dùng 2026-11-14)

> **Không làm trong module này.** Phần dưới giữ lại làm đầu vào cho một module sau (`course-payment-payos`), chưa được chốt và phải rà lại với code lúc đó. Hệ quả cho các task còn lại: V13 không thêm cột/sequence riêng cho PayOS; `.env.example` không thêm khóa PayOS; `SecurityConfiguration` không có webhook `permitAll`; mọi đơn là MANUAL (hạn 24 giờ). Vẫn giữ để sau cắm PayOS không phải đổi schema: cột `payment_transactions.provider`, `confirmation_source`, `confirmed_by` nullable và hàm xác nhận chung của 1c.

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- Cấu hình chọn MANUAL hoặc PAYOS khi tạo đơn; đơn đã tạo giữ provider gốc. PAYOS tạo link qua `POST /v2/payment-requests`, dùng số nguyên duy nhất riêng, `description` ASCII ≤9 ký tự, `amount`, URL return/cancel, `expiredAt` và chữ ký đúng mục 9; lưu orderCode số trước khi gọi. Webhook đến trước response được lưu chờ bền vững, chỉ xác nhận khi đã kiểm link ID qua response hoặc tra cứu. Trả `checkoutUrl` cho chủ đơn.
- `POST /api/v1/payments/payos/webhook` duy nhất `permitAll`: xác thực HMAC-SHA256 trên toàn bộ `data` theo mục 9, so sánh thời gian hằng trước khi xử lý; kiểm `success`, mã thành công, VND, mapping orderCode/link ID/reference và số tiền. Chỉ gọi hàm 1c khi hợp lệ; không tin browser return/cancel. Callback không khớp, ping hoặc sai dữ liệu không cấp quyền.
- Với lỗi mạng/timeout tạo link, không tạo thêm link mù quáng: lưu trạng thái chưa rõ, tra cứu theo orderCode số trước retry; không giữ khóa DB khi gọi mạng. Lỗi provider được báo an toàn, có thể thử lại mà không tạo đơn khác. Không ghi log payload nhạy cảm. Ký request/webhook, xử lý null/object/array đúng mục 9; config thiếu không bật PayOS.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| Tạo link: body/cấu hình không hợp lệ | Không nhận amount, orderCode hay URL từ client; secret bắt buộc | 400 `ORDER_INVALID` / 503 `PAYMENT_UNAVAILABLE` | Đơn không hợp lệ / thanh toán tạm thời không khả dụng. |
| Guest, sai role hoặc đơn người khác | Quyền như 1b | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` / 404 `ORDER_NOT_FOUND` | Đăng nhập / không có quyền / không tìm thấy đơn. |
| Provider timeout, từ chối, dữ liệu lỗi | Không cấp quyền; tra cứu trước retry khi kết quả chưa rõ | 503 `PAYMENT_PROVIDER_UNAVAILABLE` | Cổng thanh toán tạm thời không khả dụng; hãy thử lại. |
| Webhook sai chữ ký/body sai | Không đổi DB; không lộ chi tiết chữ ký | 400 `PAYMENT_WEBHOOK_INVALID` | Dữ liệu thông báo thanh toán không hợp lệ. |
| Webhook hợp lệ nhưng không khớp đơn/link hoặc ping | Không đổi DB; trả 2xx để tránh lặp vô ích | 200 `OK` | Đã tiếp nhận thông báo. |
| Sai số tiền, tiền tệ, trạng thái hoặc reference trùng đơn khác | Không cấp quyền; lưu bất thường bền vững để Admin đối chiếu, không đánh FAILED | 200 `OK` sau khi lưu | Đã tiếp nhận thông báo. |
| Không lưu được bất thường/chưa xử lý | Rollback, không báo đã tiếp nhận | 500 `PAYMENT_WEBHOOK_PROCESSING_FAILED` | Chưa thể tiếp nhận thông báo. |
| Webhook trùng/đồng thời | Cùng reference và số tiền: xử lý một lần | 200 `OK` | Đã tiếp nhận thông báo. |
| Webhook thành công sau hết hạn hoặc sau đơn khác đã trả | Ghi nhận khoản thật, chỉ một enrollment và cảnh báo như 1c | 200 `OK` | Đã tiếp nhận thông báo. |

### Kế hoạch thực thi

- **File:** PayOS client, signer, webhook controller/DTO, service, mapping và SecurityConfiguration (duy nhất `POST /api/v1/payments/payos/webhook` permitAll); `.env.example`, V13 cho số/mapping.
- **Dùng lại:** confirm của 1c, unique reference, khóa user/order, fake gateway test.
- **Bẫy:** `orders.order_code` varchar khác PayOS integer; `description` ≤9; response lỗi chỉ có code/desc; chữ ký webhook không giống chữ ký tạo link. Mã HTTP/chính sách retry PayOS chưa xác minh trong tài liệu: 2xx cho đã xử lý/không khớp theo mục 9.

### Xong khi

- [ ] `PayosSignatureTest` (unit vector tự dựng), `PayosGatewayTest` (fake HTTP) và `PayosWebhookControllerTest` (`@WebMvcTest`) phủ từng dòng bảng, null/object/array, chữ ký sai, lỗi/timeout và tra cứu trước retry.
- [ ] `PayosWebhookIntegrationTest` (DB/security thật với gateway giả): webhook công khai hợp lệ, đến trước response rồi kiểm link, trùng/song song, sai tiền/link/reference, lưu bất thường hoặc lỗi lưu, sau hạn và hai đơn đã trả; không gọi PayOS thật. Chạy cùng `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest`.

## Cổng wireframe

Sau Backend đã chọn và trước giao diện, tạo `plans/course-payment.wireframe.md`: luồng Author đặt giá/doanh thu, người học mua/QR/đơn, Admin đơn/xác nhận/tỷ lệ; thể hiện desktop/mobile, rỗng/lỗi/chờ/hết hạn/đã trả và cảnh báo khoản trùng. Nếu 1e được giữ, thêm checkout PayOS. Người dùng duyệt wireframe trước giao diện.

## Task 2a — Giá và quyền học

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Form Author sửa giá và xem phần nhận theo policy thực tế; danh sách/tổng quan công khai hiển thị miễn phí hoặc giá; bài bị khóa mời mua, bài học thử vẫn mở. Không hiển thị giá/doanh thu cho Moderator.
- Gọi API 1a/1b, validation và xử lý mọi mã lỗi liên quan theo bảng 1a–1b; không tự coi client là nguồn giá. Nút Mua luôn gọi POST, kể cả khi đã có đơn chờ, rồi mở đơn trả về; Guest đăng nhập rồi quay lại.

- `viewer.canStart` vẫn true khi chưa mua khóa trả phí: client dựa vào giá dương để hiện Mua; trang lesson tải thêm detail để lấy giá. Lỗi `ORDER_ALREADY_ENROLLED` hướng dẫn tải lại trang, `PAYMENT_UNAVAILABLE` thử lại bằng nút Mua; lỗi giá server hiện đầu form, ô giá không nhóm nghìn khi blur. Kicker đổi thành “Học trực tuyến”; mapping thêm `ORDER_NOT_FOUND`, `ORDER_TRANSFER_REPORT_NOT_ALLOWED`, `AUTH_*` cho 2b.

### Kế hoạch thực thi

- **File:** `Author/Courses`, `Courses`, `courseService`, `courses.ts`, `courseI18n`, route/login return nếu cần và test trực tiếp.
- **Dùng lại:** editor, overview, lesson, UI primitives, cơ chế return hiện có.
- **Bẫy:** price thay đổi tức thời, đơn cũ giữ snapshot; không truyền trường tiền vào màn Moderator.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Giá 0 / dương | Miễn phí / Mua khóa học | Free / Buy course |
| Tỷ lệ | Nền tảng giữ {rate}%, bạn nhận {amount} | Platform keeps {rate}%; you receive {amount} |
| Bài khóa | Hãy mua khóa học để tiếp tục. | Buy this course to continue. |
| Không hoàn tiền | Khóa học đã mua không được hoàn tiền. | Purchased courses are non-refundable. |

### UI

- Theo wireframe đã duyệt và `UI_GUIDE.md`; đủ trạng thái tải/rỗng/lỗi, desktop và mobile; dùng token hiện có, không thêm màu riêng. Dòng tỷ lệ dùng policy thực tế, ban đầu 20%.

### Xong khi

- [x] Validation, mapping và luồng chính; build đạt; xem [log Task 2a](course-payment.log.md).
- [ ] Test frontend liên quan: 195/196 đạt; `App.author-courses` lỗi có sẵn (chưa đạt — xem log).
- [ ] Kiểm mắt đủ dark/light × desktop/mobile và vùng chạm 44px: còn thiếu light cho editor/thẻ khóa và kiểm vùng chạm (chưa kiểm — xem log).

## Task 2b — Thanh toán và đơn của tôi

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Trang chi tiết đơn hiển thị mã, tên ngân hàng/tài khoản, số tiền, nội dung và ảnh VietQR động; danh sách đơn của tôi, trạng thái, hết hạn và đường vào học khi PAID. Không tự coi chuyển khoản hay return URL là thành công; làm mới trạng thái theo thao tác người dùng. Đơn MANUAL đang chờ/hết hạn có nút “Tôi đã chuyển khoản” (API 1b); sau khi bấm hiện thời điểm đã báo và câu chờ Admin đối chiếu, nút không bấm lại được.
- Không có nút checkout PayOS hay trang return/cancel (1e hoãn). Mapping lỗi/validation dẫn bảng 1b; ảnh QR lỗi vẫn hiện thông tin chuyển khoản.

- QR dùng nền trắng `bg-white` để quét; màu trạng thái nằm trong `OrdersPage` (`ORDER_TONE`). Thời gian còn lại tính ở client từ `expiresAt`, hiển thị giờ hoặc phút khi dưới một giờ.

### Kế hoạch thực thi

- **File:** `Payments`, services/types/data payment/order, `App.tsx`, sidebar/navigation và test caller trực tiếp.
- **Dùng lại:** API client, pagination, primitives, guard và return đang có.
- **Bẫy:** URL ảnh encode query; dữ liệu QR lấy từ API; trạng thái EXPIRED vẫn có thể nhận tiền và được Admin xác nhận.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Chờ | Chờ Admin xác nhận chuyển khoản | Awaiting transfer confirmation |
| Hết hạn | Đơn đã hết hạn; liên hệ Admin nếu đã chuyển khoản. | This order has expired; contact an admin if you already transferred. |
| Thành công | Đã nhận tiền · Vào học | Payment received · Start learning |
| QR lỗi | Không tải được QR; dùng thông tin chuyển khoản bên dưới. | QR unavailable; use the transfer details below. |
| Báo chuyển khoản | Tôi đã chuyển khoản / Đã báo cho Admin lúc {time}; quyền học được mở sau khi Admin đối chiếu. | I have transferred / Reported to admin at {time}; access opens after the admin verifies the transfer. |

### UI

- Theo wireframe và `UI_GUIDE.md`; có tải/rỗng/lỗi, chờ/hết hạn/đã trả, copy mã và số tài khoản, mobile/desktop. Dùng token hiện có; riêng nền QR dùng trắng để quét.

### Xong khi

- [x] Test luồng đơn, mapping, QR và các caller liên quan; build đạt; xem [log Task 2b](course-payment.log.md).
- [x] Kiểm mắt dark/light × desktop/mobile, kể cả các trạng thái đơn; xem log.

## Task 2c — Admin và doanh thu tác giả

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Admin lọc đơn (trạng thái, mã, “người học đã báo chuyển khoản”, “cần đối chiếu”), thấy nhãn và thời điểm người học báo chuyển khoản, thấy cảnh báo thanh toán trùng và đóng cờ sau đối chiếu qua API 1c; nhập số tiền/mã sao kê và xác nhận có bước kiểm tra lại; sửa tỷ lệ và xem ngày hiệu lực. Tác giả xem tổng và danh sách doanh thu theo snapshot; không đề cập đã được chi trả.
- Validation và mapping tất cả lỗi tương ứng bảng 1c–1d. Moderator không có route hay dữ liệu doanh thu; backend vẫn là ranh giới phân quyền.

- Bộ lọc Admin gồm ô mã, select trạng thái và hai checkbox; mobile xếp dọc, nút Xóa bộ lọc chỉ hiện ở trạng thái rỗng. Lỗi server (kể cả `PAYMENT_INVALID`) hiện trong Alert đầu Sheet, lỗi client dưới ô. So `id` policy trả về với hiện tại để xác định không đổi. Mọi đơn PAID có nút “Xem · Đối chiếu” để ghi khoản chuyển trùng đầu tiên; cảnh báo và nút đóng cờ chỉ hiện khi cờ mở. Test nằm trong ba file trang, không tách lớp test riêng; `Sidebar.test` kiểm link `/author/revenue`.

### Kế hoạch thực thi

- **File:** `Admin/Orders`, `Admin/Commission`, `Author/Revenue`, services/types/data, `App.tsx`, `AdminSidebar`, `Sidebar`, navigation và test trực tiếp.
- **Dùng lại:** AdminPagination, form/dialog primitives, API client, locale hiện có.
- **Bẫy:** không dùng tổng trong client để xác nhận; sau success tải lại server; snapshot đơn cũ không theo tỷ lệ mới.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Đối chiếu | Đã nhận tiền / Kiểm tra sao kê trước khi xác nhận | Payment received / Check the bank statement before confirming |
| Trùng | Có khoản thanh toán trùng cần đối chiếu / Đã đối chiếu | Duplicate payment requires reconciliation / Reconciled |
| Doanh thu | Doanh thu tác giả / Nền tảng giữ / Bạn nhận | Author revenue / Platform share / Your share |
| Chính sách | Tỷ lệ hoa hồng · Hiệu lực từ {date} | Commission rate · Effective from {date} |

### UI

- Theo wireframe và `UI_GUIDE.md`; danh sách có tải/rỗng/lỗi, xác nhận và lỗi đối chiếu; desktop/mobile. Dùng token hiện có, không thêm màu riêng.

### Xong khi

- [x] Test luồng Admin, doanh thu, mapping và các caller liên quan; build đạt; xem [log Task 2c](course-payment.log.md).
- [x] Kiểm mắt dark/light × desktop/mobile với API giả; xem log.
- [ ] Kiểm với backend thật (chưa kiểm — xem log).

## Câu hỏi mở cần người dùng chốt

Không còn câu nào: năm câu (khoảng giá, hạn đơn, thanh toán trùng, E1–E3, hiệu lực tỷ lệ hoa hồng) đã có trả lời ngày 2026-11-14 ở mục “Quyết định của người dùng” và đã đưa vào thân spec. Việc còn lại trước khi bật tiền thật (không chặn chốt spec): cấu hình tài khoản nhận trong `.env`; riêng 1e phải xác minh giới hạn số tiền và quy tắc webhook/retry của PayOS, và có thể cắt.

## Quyết định của người dùng

**Người dùng chốt spec 2026-11-14** (Task 1a–1d, cổng wireframe, 2a–2c; 1e hoãn). Lịch sử phản biện: [`course-payment.review.md`](course-payment.review.md).

1. Giá: 0 (miễn phí) hoặc 10.000–50.000.000 VND.
2. Hạn đơn: MANUAL 24 giờ, PAYOS 15 phút; hết hạn thì tạo đơn mới, tiền đến sau vẫn được Admin xác nhận.
3. Thanh toán trùng: ghi từng khoản đúng tiền (kể cả reference mới cùng đơn), một enrollment, doanh thu một lần/item, cờ đối chiếu cho Admin; tiền thừa xử lý ngoài hệ thống, không hoàn tiền.
4. E1 (nút “Tôi đã chuyển khoản”, Admin lọc theo cờ; cờ không thay xác nhận sao kê): **làm trong module này** (1b + 2b). E2: không làm. E3: tách sau.
5. Đổi tỷ lệ hoa hồng có hiệu lực ngay khi Admin lưu, không đặt lịch.
6. **PayOS hoãn (2026-11-14):** không làm Task 1e trong module này; chỉ VietQR + Admin xác nhận. Tự xác nhận qua webhook là module sau.
7. Vòng 2 phản biện không chạy; Claude chấp nhận lý do từ chối X1, X2. Phần “Tôi đã chuyển khoản” (quyết định 4) do Claude đưa vào thân spec sau vòng 1, chưa qua Codex soát.

- (2026-11-15) Cho phép Claude push nhánh PR đang mở để gỡ CI; không push `main`, người dùng tự merge.
