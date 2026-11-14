# Course payment

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Codex viết; Claude chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Tác giả đặt giá, người học mua từng khóa bằng chuyển khoản ngân hàng và được cấp quyền; nền tảng lưu hoa hồng, tác giả xem doanh thu. Bước đầu Admin đối chiếu VietQR; PayOS webhook tự xác nhận là task Backend cuối có thể cắt.
**Làn:** Đầy đủ · **Rủi ro cao:** tiền, đồng thời, webhook công khai; review vòng 1 dùng `adversarial-review`.
**Thứ tự:** 1a → 1b → 1c → 1d → 1e (PayOS, có thể cắt) → cổng wireframe → 2a → 2b → 2c. Mỗi task dự kiến nửa ngày đến một ngày; trễ quá một ngày báo người dùng để cắt. Backend đã chọn phải xong và review trước wireframe/giao diện; nếu cắt 1e, giao diện chỉ mở VietQR.

## Đường dẫn thuộc module

Chỉ sửa các đường dẫn sau; file mới đặt theo kiến trúc hiện có. Test mới nằm cạnh test miền tương ứng.

- `server/src/main/resources/db/migration/V13__course_payment.sql`, `server/src/main/resources/application*.yaml`, `.env.example`.
- `server/src/main/java/com/techverse/server/{controller,entity,enums,dto,repository,service,properties}/**/*{Course,Lesson,Order,Payment,Commission,Revenue,Payos,Vietqr}*.java`; `server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java`, `server/src/main/java/com/techverse/server/exception/ErrorCode.java`; `service/impl/OrderRateLimitService.java` riêng cho đơn.
- `server/src/test/java/com/techverse/server/{course,payment}/**/*.java` (kể cả lớp mới và `CourseIntegrationTestBase`); `server/src/test/java/com/techverse/server/article/ArticlePublicationMigrationTest.java` nếu assertion phiên bản Flyway cần sửa.
- `plans/course-payment.wireframe.md` (tạo ở cổng wireframe); `app/src/{App.tsx,App.*.test.tsx,StaffPreferences.test.tsx}`, `app/src/{types,services,data}/*{course,Course,payment,Payment,order,Order,commission,Commission,revenue,Revenue,navigation}*`, `app/src/services/returnTo.ts`, `app/src/pages/Login/**`, `app/src/components/layout/{Sidebar,AdminSidebar}.tsx` và test trực tiếp.
- `app/src/pages/{Courses,Author/Courses,Author/Revenue,Admin/Orders,Admin/Commission,Payments}/**` và test; `app/src/components/ui/{sidebar,labels,focus}*.test.*` khi sửa shell.

## Ngoài phạm vi

- Đăng ký bán, điều khoản bán nhiều phiên bản, thông tin chi trả tác giả, sổ tiền và chi trả; giỏ hàng, giảm giá, hoàn tiền, Admin cấp tặng hoặc thu hồi quyền.
- VNPay, tiền mặt, trang cổng giả lập cho người dùng, gọi VietQR/PayOS thật trong test; lưu bí mật hoặc thông tin ngân hàng vào frontend cấu hình cứng.
- Thay provider video, bảo vệ link YouTube khỏi người đã mua chia sẻ; thời lượng, AI tutor và chức năng khóa học khác.

## Ràng buộc chung

- Đổi API/DB: Có, chỉ migration mới V13; không sửa V1–V12. Giữ contract `ApiResponse`/`ErrorResponse` và hành vi khóa miễn phí. Không sửa `final.sql` trong module này.
- Giá nguyên VND: 0 hoặc khoảng dương chờ chốt (đề xuất 10.000–50.000.000); VietQR tối đa 13 chữ số, chưa xác minh giới hạn PayOS. Giá và nội dung chuyển khoản lấy từ DB/cấu hình. Hạn MANUAL đề xuất 24 giờ, PAYOS 15 phút, chờ chốt; giá và policy snapshot khi tạo đơn.
- Giá nằm trên `courses`, ngoài snapshot duyệt; đổi giá dương có hiệu lực ngay cho đơn mới. Khóa từng công khai (`published_version_id IS NOT NULL`) không đổi loại 0 ↔ dương kể cả sau ẩn/gỡ; kiểm trong transaction cùng khóa dòng course khi sửa và công khai. Moderator không nhận giá, doanh thu, thông tin ngân hàng từ API quản lý hoặc giao diện.
- Guest xem tổng quan và bài học thử; người chưa có enrollment active không nhận nội dung/video bài thường và không tạo FREE enrollment cho khóa trả phí. Người mua/đã có enrollment active học bình thường. Owner không mua khóa mình; ADMIN/MODERATOR không mua/học theo luật `course-free`.
- Cấu hình tài khoản nhận và secret chỉ ở backend `.env`, mẫu để trống; không log secret/chữ ký. VietQR dựng URL ảnh từ tham số backend, encode query; không gọi dịch vụ khi test. Khi dùng QR thật, trình duyệt liên hệ VietQR và chịu giới hạn 10 ảnh/10 giây/IP theo tài liệu.
- Đối chiếu thật do Admin chịu trách nhiệm: xác nhận chỉ sau khi kiểm sao kê, mã đơn và số tiền. Không có hoàn tiền; hiển thị trước khi mua. PayOS chỉ webhook đã kiểm chữ ký được xác nhận; return/cancel trình duyệt chỉ hiển thị, không cấp quyền.
- Nguồn tham khảo và thứ tự ưu tiên: [`course-payment.directions.md`](course-payment.directions.md) mục 8–9; mục 8 thắng hướng cũ. Quy tắc chưa chốt được nêu ở cuối spec.

## Task 1a — Schema, giá và quyền xem

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- V13 thay `ck_courses_free`, seed policy chung 2000 bps có hiệu lực ngay; xóa `refunds`, hai trigger/function liên quan và loại khỏi danh sách audit được tạo động nếu cần, không sửa V1. Test migration từ V1–V13 và trên DB rỗng.
- Tác giả APPROVED sở hữu khóa đặt/sửa giá; API public list/detail trả giá và VND; API Author trả giá và policy hiện tại để tính phần nhận. Moderator DTO/query không chứa trường tiền. `CourseContractTest` cho phép tiền ở `CourseWriteRequest`, `CourseResponse`, `CourseSummaryResponse`, `PublishedCourseSummaryResponse`, `PublishedCourseDetailResponse`; cấm ở `ModeratorCourseDetailResponse`, `ModeratorCourseSummaryResponse` và các DTO còn lại; giữ kiểm video URL.
- Điều chỉnh start, đọc bài và tiến độ theo ràng buộc chung; không lộ payload bài thường qua API khác. Giá có hiệu lực độc lập kiểm duyệt nội dung.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `priceAmount` | Bắt buộc số nguyên VND trong khoảng chung | 400 `COURSE_PRICE_INVALID` | Giá khóa học không hợp lệ. |
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

- [ ] `CoursePaymentMigrationTest` (Flyway thuần): constraint giá, seed policy, xóa refunds/trigger/function và trigger còn lại hoạt động.
- [ ] `CoursePriceServiceTest` (unit) và `AuthorCourseIntegrationTest`: mọi dòng giá/quyền/trạng thái trong bảng, kể cả sửa giá và công khai đồng thời.
- [ ] `PublishedCourseIntegrationTest`, `CourseLearningIntegrationTest`, `ModeratorCourseIntegrationTest`, `CourseContractTest`: từng dòng quyền/nội dung, preview, khóa miễn phí regression; Moderator không nhận tiền. 1a kiểm chưa mua; PURCHASE học được kiểm ở 1c.
- [ ] Chạy các lớp trên cùng `FreeCourseMigrationTest`, `CoursePersistenceIntegrationTest`, `CourseLifecycleTest` và `ArticlePublicationMigrationTest` nếu sửa; Docker cho test tích hợp. Full backend do CI chạy khi mở PR.

## Task 1b — Đơn hàng và VietQR

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `POST /api/v1/orders {courseId}`, `GET /api/v1/me/orders`, `GET /api/v1/orders/{orderCode}`: mỗi đơn một khóa; chủ đơn xem QR khi chờ/hết hạn để đối chiếu; danh sách phân trang. Trả mã, snapshot tên/giá, trạng thái, thời hạn, tham số VietQR; không trả secret.
- Sinh mã `TV` + 12 chữ số từ sequence duy nhất, ASCII, không tái sử dụng; vừa nội dung chuyển khoản ≤50 ký tự vừa không lộ UUID. Đơn PENDING quá hạn theo provider đánh EXPIRED khi đọc/tạo đơn; không scheduler. Request mới sau hết hạn tạo đơn mới.
- Trong transaction khóa dòng user trước kiểm enrollment và đơn chờ cùng khóa; trả lại đơn PENDING còn hạn cho các request đồng thời. Public detail không trả đơn chờ: nút Mua gọi POST rồi mở đơn được trả về. Chụp giá và policy đang hiệu lực tại thời điểm tạo item; tạo order tổng 0 → insert item → đọc tổng trigger → tạo transaction MANUAL PENDING.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `courseId` | UUID bắt buộc, không nhận giá/tổng từ client | 400 `ORDER_INVALID` | Thông tin đơn hàng không hợp lệ. |
| Đăng nhập, role, chủ đơn/khóa | Guest / ADMIN, MODERATOR, chủ khóa / xem đơn người khác | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` / 404 `ORDER_NOT_FOUND` | Đăng nhập / không có quyền / không tìm thấy đơn. |
| Khóa không tồn tại, không công khai, miễn phí | Chỉ bán khóa công khai có giá dương | 404 `COURSE_NOT_FOUND` / 409 `ORDER_COURSE_UNAVAILABLE` | Không tìm thấy khóa / không thể mua. |
| Đã có enrollment active | Không tạo đơn mới | 409 `ORDER_ALREADY_ENROLLED` | Bạn đã có quyền học khóa này. |
| Đơn còn hạn / tạo đồng thời | Cùng user, khóa: trả cùng đơn, không nhân bản | 200 `OK` | Tiếp tục thanh toán đơn đang chờ. |
| Đơn hết hạn | Giữ lịch sử, tạo đơn mới; tiền về sau vẫn xử lý theo 1c | 200 `OK` | Đơn đã hết hạn; liên hệ Admin nếu đã chuyển khoản. |
| Cấu hình ngân hàng thiếu/sai, policy không hiệu lực | Không tạo đơn không thể thanh toán; lỗi tạm thời | 503 `PAYMENT_UNAVAILABLE` | Thanh toán tạm thời không khả dụng. |
| Tạo quá nhanh | Tối đa 5 request/phút/user, kể cả retry | 429 `ORDER_RATE_LIMITED` | Bạn thao tác quá nhanh, hãy thử lại sau. |

### Kế hoạch thực thi

- **File:** order/payment DTO, service, repository, controller, cấu hình VietQR; security authenticated cho `POST /api/v1/orders`, `GET /api/v1/orders/*`, `GET /api/v1/me/orders`; V13 thêm sequence/index thực sự cần.
- **Dùng lại:** trigger `refresh_order_total`, `calculate_order_item_revenue`; rate limit riêng theo mẫu hiện có, không sửa `ArticleRateLimitService`.
- **Bẫy:** flush/đọc lại tổng sau trigger; policy và thay đổi giá phải khóa/đọc nhất quán; không giữ DB lock trong khi gọi dịch vụ ngoài.

### Xong khi

- [ ] `OrderServiceTest` (unit) và `OrderControllerTest` (`@WebMvcTest`) phủ mọi dòng bảng, định dạng mã/QR, dữ liệu ngoài phạm vi và rate limit.
- [ ] `OrderIntegrationTest` (DB/security thật): mua, quyền/chủ sở hữu, hết hạn/tạo lại, hai request song song cùng đơn; snapshot giá/tỷ lệ và tổng trigger đúng. Không gọi VietQR thật.
- [ ] Chạy các lớp trên và các lớp caller của rate limit nếu sửa code dùng chung; full backend do CI chạy khi mở PR.

## Task 1c — Admin xác nhận, đồng thời và doanh thu

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/admin/orders` lọc trạng thái/mã, phân trang; `POST /api/v1/admin/orders/{orderCode}/confirm` nhận `amount` nguyên và `bankReference` bắt buộc 1–255 ký tự đã trim, Admin nhập từ sao kê. `GET /api/v1/author/revenue` chỉ tổng và danh sách item PAID của khóa thuộc tác giả hiện tại, gồm giá, tỷ lệ, phần nền tảng và phần tác giả, phân trang; không chứa thông tin người mua.
- Hàm xác nhận chung: khóa user rồi order/transaction theo thứ tự cố định; so sánh amount với snapshot, kiểm reference duy nhất và trạng thái; ghi audit người xác nhận, thời điểm và reference, cập nhật transaction SUCCEEDED để trigger đặt PAID/cấp quyền trong cùng transaction. PENDING hoặc EXPIRED đều được xác nhận. Admin chỉ xác nhận đơn MANUAL; không xác nhận hộ PayOS.
- **Đề xuất chờ chốt:** nếu đơn cũ thanh toán sau khi đơn khác đã cấp quyền, ghi PAID và reference cho từng khoản thật, giữ một enrollment active và cảnh báo Admin đối chiếu. V13 sửa trigger dùng `INSERT … SELECT … WHERE NOT EXISTS` enrollment active, vẫn xử lý conflict `order_item_id`, tuần tự hóa theo user; không mở chức năng revoke.
- Retry cùng đơn/reference/số tiền trả kết quả cũ; reference đã dùng cho đơn khác báo xung đột. **Đề xuất chờ chốt:** reference mới cùng đơn PAID, đúng tiền ghi transaction SUCCEEDED mới, cảnh báo, không nhân doanh thu/item hay quyền. Sai số tiền không đánh FAILED hoặc cấp quyền.
- Audit: `payment_transactions.confirmed_by` nullable (MANUAL là Admin, PAYOS null), `confirmation_source`, `confirmed_at`; `orders` lưu cờ đối chiếu và người/thời điểm đóng. Admin gọi `POST /api/v1/admin/orders/{orderCode}/reconcile` để đóng cờ; khoản bất thường mới mở lại cờ, không sửa giao dịch/quyền.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `amount`, `bankReference` | Số nguyên dương; reference trim 1–255 ký tự | 400 `PAYMENT_INVALID` | Thông tin đối chiếu không hợp lệ. |
| Guest / không phải Admin, không phải Author | Theo role và trạng thái tác giả; doanh thu chỉ của mình | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` | Đăng nhập / không có quyền. |
| Không có đơn | Không tiết lộ dữ liệu khác | 404 `ORDER_NOT_FOUND` | Không tìm thấy đơn. |
| Sai số tiền | So với tổng snapshot, không thay trạng thái | 409 `PAYMENT_AMOUNT_MISMATCH` | Số tiền không khớp đơn; hãy đối chiếu sao kê. |
| Đơn sai provider/trạng thái | Chỉ MANUAL PENDING/EXPIRED hoặc retry đúng PAID | 409 `PAYMENT_STATE_INVALID` | Không thể xác nhận đơn ở trạng thái này. |
| Reference trùng đơn khác | Không gán cùng giao dịch cho hai đơn | 409 `PAYMENT_REFERENCE_CONFLICT` | Mã giao dịch đã được dùng hoặc không khớp. |
| Reference mới cùng đơn PAID | Đề xuất chờ chốt: ghi khoản đúng tiền, cảnh báo, không nhân doanh thu/quyền | 200 `OK` | Đã ghi nhận; cần đối chiếu khoản trùng. |
| Đóng cờ đối chiếu | Admin; retry trả kết quả cũ, không có cờ báo lỗi, không có đơn báo 404 | 200 `OK` / 409 `PAYMENT_RECONCILIATION_NOT_REQUIRED` / 404 `ORDER_NOT_FOUND` | Đã đối chiếu / Không có khoản cần đối chiếu / Không tìm thấy đơn. |
| Retry đúng, xác nhận song song | Một lần chuyển trạng thái; trả kết quả cũ | 200 `OK` | Đã ghi nhận thanh toán. |
| Đơn hết hạn hoặc đã có enrollment từ đơn khác | Ghi nhận tiền thật; chỉ một quyền active, cảnh báo đối chiếu khoản trùng | 200 `OK` | Đã ghi nhận; cần đối chiếu nếu có khoản thanh toán trùng. |

### Kế hoạch thực thi

- **File:** Admin order/revenue controller, DTO, service, repository; security authenticated cho `GET /api/v1/author/revenue`, `/api/v1/admin/**` đã authenticated, service kiểm role; V13 bổ sung audit/cờ và sửa trigger cấp quyền; test payment.
- **Dùng lại:** trigger xác thực tổng, tính hoa hồng và cấp quyền; hàm xác nhận dùng tiếp ở 1e.
- **Bẫy:** unique `(user, course)` active không được `ON CONFLICT (order_item_id)` che; JPA cache cũ sau trigger; khóa theo user để tuần tự hóa cả hai đơn khác nhau.

### Xong khi

- [ ] `PaymentConfirmationServiceTest` (unit), `AdminOrderControllerTest` và `AuthorRevenueControllerTest` (`@WebMvcTest`): mọi dòng bảng, dữ liệu sai, role và mapping lỗi, đóng cờ/retry/sai quyền/không có cờ hoặc đơn.
- [ ] `PaymentConfirmationIntegrationTest` (DB/security thật): thành công + trigger/snapshot và học được; sai tiền; trùng/đồng thời cùng reference; hết hạn; hai đơn cùng khóa trả sau cả trước và sau khi đơn mới PAID; reference trùng khác đơn bị chặn; theo quyết định người dùng kiểm thêm reference mới cùng đơn, một enrollment/doanh thu và đóng/mở lại cờ.
- [ ] `AuthorRevenueIntegrationTest`: chỉ PAID, tổng khớp snapshot, phân trang và cô lập tác giả; Moderator không thấy. Chạy các lớp trên + `OrderIntegrationTest`, `CourseLearningIntegrationTest`.

## Task 1d — Chính sách hoa hồng

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/admin/commission-policy`, `PUT /api/v1/admin/commission-policy {rateBps}`; Admin đổi tỷ lệ chung, hiệu lực ngay tại thời điểm server ghi, tạo policy mới có `effective_from`, đóng policy cũ và giữ lịch sử. Không đặt lịch tương lai trong phạm vi này. Author đọc tỷ lệ hiệu lực qua API Task 1a; đơn cũ không tính lại.
- Cả đổi policy và tạo item lấy cùng PostgreSQL advisory transaction lock cố định trước khi đọc policy active, đọc lại sau khi lấy khóa và giữ đến commit; mỗi đơn nhận policy hiệu lực tại thời điểm tạo item. Giới hạn 0–10000 bps, số nguyên. Phần tác giả = giá − floor(giá × bps / 10000).

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Câu hiển thị tương ứng |
|---|---|---|---|
| `rateBps` | Bắt buộc nguyên 0–10000, không nhận ngày từ client | 400 `COMMISSION_RATE_INVALID` | Tỷ lệ không hợp lệ. |
| Guest / không phải Admin | Chỉ Admin đọc/đổi policy quản trị | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` / 403 `ACCESS_DENIED` | Đăng nhập / không có quyền. |
| Đổi trùng tỷ lệ | Trả policy hiện tại, không tạo bản mới | 200 `OK` | Tỷ lệ hiện tại không đổi. |
| Đổi đồng thời / đồng thời tạo đơn | Tuần tự hóa; một policy active, snapshot nhất quán | 200 `OK` | Đã cập nhật tỷ lệ. |
| Không có policy hợp lệ | Không tạo đơn | 503 `PAYMENT_UNAVAILABLE` | Thanh toán tạm thời không khả dụng. |

### Kế hoạch thực thi

- **File:** commission controller/service/repository/DTO, `Order` service và V13 nếu cần khóa DB.
- **Dùng lại:** unique active policy và trigger V1; V13 chặn đổi `rate_bps` policy đã tạo, cho đóng `effective_to`/`is_active`; chặn sửa giá, policy, tỷ lệ và số tiền snapshot item sau insert, cho cập nhật hợp lệ khác. Đọc lại giá trị trigger.
- **Bẫy:** unique chỉ cho một active; đóng và tạo mới nguyên tử; tránh timestamp trùng làm sai `effective_to > effective_from`.

### Xong khi

- [ ] `CommissionPolicyServiceTest` (unit), `CommissionPolicyControllerTest` (`@WebMvcTest`): mọi dòng bảng, làm tròn và phân quyền.
- [ ] `CommissionPolicyIntegrationTest`: đổi đồng thời và tạo đơn đồng thời với đổi policy, chỉ một policy active, snapshot cũ bất biến kể cả khi thử UPDATE trực tiếp policy/item, policy mới có ngày hiệu lực; chạy cùng `OrderIntegrationTest` và `PaymentConfirmationIntegrationTest`.

## Task 1e — PayOS webhook (cuối Backend, cắt được)

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

- [ ] Test unit validation/format và mapping mọi dòng lỗi 1a–1b, cả vi/en; luồng chính form → mua, Guest quay lại, preview và bài khóa; kiểm tĩnh Moderator không nhận trường tiền.
- [ ] Chạy `courseService.test.ts`, `courseI18n.test.ts`, `Author/Courses/CourseEditorPage.test.tsx`, `Courses/{CoursesPage,CourseOverviewPage,CourseLessonPage}.test.tsx`, `App.author-courses.test.tsx`, `App.courses.test.tsx` và test caller bị sửa + `npm run build` trong `app/`.
- [ ] Kiểm mắt trang đổi: dark/light × desktop/mobile, một lượt; ghi log.

## Task 2b — Thanh toán và đơn của tôi

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Trang chi tiết đơn hiển thị mã, tên ngân hàng/tài khoản, số tiền, nội dung và ảnh VietQR động; danh sách đơn của tôi, trạng thái, hết hạn và đường vào học khi PAID. Không tự coi chuyển khoản hay return URL là thành công; làm mới trạng thái theo thao tác người dùng.
- Nếu 1e được giữ, thêm nút checkout PayOS và trang return/cancel chỉ tra cứu trạng thái. Mapping lỗi/validation dẫn bảng 1b, 1e; ảnh QR lỗi vẫn hiện thông tin chuyển khoản.

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

### UI

- Theo wireframe và `UI_GUIDE.md`; có tải/rỗng/lỗi, chờ/hết hạn/đã trả, copy mã và số tài khoản, mobile/desktop. Dùng token hiện có, không thêm màu riêng.

### Xong khi

- [ ] Test unit URL QR và mapping tất cả dòng 1b/1e theo vi/en; test luồng chính đơn, QR lỗi, hết hạn, đã trả, return không tự xác nhận.
- [ ] Chạy test mới `Payments/*.test.tsx`, services/data liên quan, `App.courses.test.tsx`, `Sidebar.test.tsx`, `StaffPreferences.test.tsx`, `components/ui/{sidebar,labels,focus}*.test.*` khi sửa shell và test caller trực tiếp + `npm run build` trong `app/`.
- [ ] Kiểm mắt trang đổi: dark/light × desktop/mobile, một lượt; ghi log.

## Task 2c — Admin và doanh thu tác giả

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Admin lọc đơn, thấy cảnh báo thanh toán trùng và đóng cờ sau đối chiếu qua API 1c; nhập số tiền/mã sao kê và xác nhận có bước kiểm tra lại; sửa tỷ lệ và xem ngày hiệu lực. Tác giả xem tổng và danh sách doanh thu theo snapshot; không đề cập đã được chi trả.
- Validation và mapping tất cả lỗi tương ứng bảng 1c–1d. Moderator không có route hay dữ liệu doanh thu; backend vẫn là ranh giới phân quyền.

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

- [ ] Test unit validation/mapping vi/en cho mọi dòng 1c–1d; test luồng Admin xác nhận/sai tiền/trùng/đóng cờ, đổi tỷ lệ và doanh thu Author chỉ hiện dữ liệu server.
- [ ] Chạy test mới `Admin/{Orders,Commission}/**`, `Author/Revenue/**`, service/data tương ứng, `Sidebar.test.tsx`, `StaffPreferences.test.tsx`, `components/ui/{sidebar,labels,focus}*.test.*` khi sửa shell, test `App` và caller trực tiếp bị sửa + `npm run build` trong `app/`.
- [ ] Kiểm mắt trang đổi: dark/light × desktop/mobile, một lượt; ghi log.

## Câu hỏi mở cần người dùng chốt

1. **Khoảng giá:** khuyến nghị 0 hoặc 10.000–50.000.000 VND; VietQR chỉ chứng minh giới hạn kỹ thuật 13 chữ số, PayOS chưa xác minh. Chọn khoảng nào?
2. **Hạn đơn:** khuyến nghị MANUAL 24 giờ, PAYOS 15 phút; hết hạn cho tạo đơn mới, tiền đến sau vẫn đối chiếu. Chọn thời hạn nào?
3. **Thanh toán trùng:** khuyến nghị ghi từng khoản đúng tiền, kể cả reference mới cùng đơn; một enrollment, doanh thu một lần/item và cờ Admin đối chiếu; xử lý tiền thừa ngoài phạm vi, không tự hoàn. Chọn phương án nào?
4. **E1–E3:** khuyến nghị E1 tách module sau, E2 không cần lúc này, E3 tách module sau. Có chọn đưa đề xuất nào vào module này không?
5. Chính sách hoa hồng hiệu lực ngay khi lưu, không đặt lịch: chấp nhận? Trước khi bật thật cần cấu hình tài khoản, xác minh giới hạn PayOS và quy tắc webhook/retry; 1e có thể cắt.

## Phản hồi vòng 1 (Claude)

Đã đối chiếu V1 (`orders`, `order_items`, `payment_transactions`, `commission_policies`, trigger 614–642, 803–831), `ErrorCode`, `ArticleRateLimitService`, `Course`, `CourseContractTest`; mọi lớp test/file frontend spec nêu đều tồn tại.

**Sai**

- S1. `UNAUTHORIZED`, `RATE_LIMITED` không có trong `ErrorCode`. 401 hiện là `AUTH_ACCESS_TOKEN_REQUIRED`/`AUTH_INVALID_ACCESS_TOKEN` (entry point); rate limit đặt theo miền (`COURSE_RATE_LIMITED`, `AI_RATE_LIMITED`). Đề nghị `ORDER_RATE_LIMITED` + ngưỡng cụ thể (vd. 5 đơn/phút/user), 401 ghi mã có sẵn.
- S2. “Dùng lại `ArticleRateLimitService`”: API là `check(UUID user, boolean image)`, riêng bài viết; dùng lại = sửa code dùng chung, kéo test caller article. Đề nghị lớp rate limit riêng cho đơn theo mẫu hiện có, bỏ dòng đó khỏi “Đường dẫn”.
- S3. 1c “khác reference trên đơn đã PAID → xung đột, không đổi dữ liệu” trái nguyên tắc “ghi nhận mọi khoản thật” của chính task. Chuyển hai lần cùng một mã đơn là ca thực tế nhất; schema cho phép: transaction SUCCEEDED thứ hai qua `validate_payment_transaction` (amount = tổng), grant trigger `ON CONFLICT (order_item_id)` không cấp thêm. Đề nghị ghi transaction thứ hai + cờ đối chiếu như ca hai đơn.
- S4. 1e: webhook đã đúng chữ ký nhưng sai tiền/trạng thái/reference trả 409, trong khi cùng bảng cho “không khớp đơn” trả 2xx “để tránh lặp” và mục 9 nói chưa rõ chính sách retry. Đề nghị: mọi webhook đúng chữ ký trả 200 và lưu bất thường để đối chiếu; chỉ chữ ký/body sai trả 400.
- S5. Khoảng giá 1–9.999.999.999.999 là giới hạn ô `amount` của VietQR (13 chữ số), không phải giá hợp lý cho người dùng thấy. Đề nghị 10.000–50.000.000 VND (chờ người dùng, xem câu hỏi mở 1).

**Thiếu**

- T1. Hạn 15 phút không hợp với xác nhận tay: Admin có thể xác nhận sau vài giờ, nên gần như mọi người mua sẽ thấy “Đơn đã hết hạn; liên hệ Admin” dù chuyển đúng. Đề nghị đơn MANUAL hạn 24 giờ (hạn chỉ quyết định trả đơn cũ hay tạo đơn mới; vẫn xác nhận được sau hạn), PayOS giữ 15 phút qua `expiredAt`. Cần người dùng chốt.
- T2. “Khóa từng công khai” chưa định nghĩa: ghi rõ `courses.published_version_id IS NOT NULL` (snapshot còn sau ẩn/gỡ; `Course.publishedVersion`).
- T3. Audit và cờ đối chiếu chưa nói nằm ở đâu: cột nào, bảng nào trong V13; webhook không có user nên `confirmed_by` NULL + nguồn PAYOS. Thiếu thao tác Admin “đã đối chiếu xong” để bỏ cờ, nếu không cảnh báo hiện mãi.
- T4. Sửa trigger cấp quyền ở V13 chưa cụ thể: đề nghị `INSERT … WHERE NOT EXISTS (enrollment active cùng user, course)`. Sau khi xóa trigger refund, không còn đường revoke nào trong code → bỏ ca “không cấp lại quyền đã revoke” hoặc nói rõ hành vi.
- T5. Policy phải bất biến: `calculate_order_item_revenue` chạy cả `BEFORE UPDATE` và đọc `rate_bps` theo `commission_policy_id`. Nếu ai sửa `rate_bps` của policy cũ hoặc update `order_items`, snapshot đơn cũ đổi theo. V13 cần chặn UPDATE `rate_bps` (chỉ cho đóng `effective_to`/`is_active`) và chặn update giá/policy của `order_items`.
- T6. 1d “khóa tuần tự đổi policy và tạo item”: chốt cơ chế, vd. `SELECT … FOR UPDATE` dòng policy active ở cả hai đường, thay vì để người code chọn.
- T7. Security: `/api/v1/author/revenue`, `/api/v1/orders/**`, `/api/v1/me/orders` chưa có matcher (mặc định `denyAll`); webhook `permitAll` đúng một đường. Liệt kê matcher trong Kế hoạch thực thi 1b/1c/1e.
- T8. Người đang có đơn PENDING mở lại trang khóa thấy “Mua” hay “Xem đơn đang chờ”? API public detail có trả đơn chờ của người gọi không? Chốt ở 1b/2a.

**Thừa**

- X1. 1e “webhook đến trước response được lưu chờ, chỉ xác nhận khi đã kiểm link ID”: orderCode số đã lưu trước khi gọi PayOS, nên map theo orderCode + amount + chữ ký là đủ; bỏ cơ chế lưu chờ. Retry: PayOS báo “đơn đã tồn tại” với cùng orderCode → GET lấy `checkoutUrl`; không cần trạng thái “chưa rõ” riêng.
- X2. 1d là một task riêng với ma trận đồng thời policy × đơn cho thao tác Admin hiếm dùng. Với hạn 28/11, đề nghị gộp vào 1c, giữ một ca đồng thời.

**Ranh giới task**

- R1. 1a chặn bài thường/start với khóa trả phí nhưng chưa có đường mua (1b/1c). Test 1a muốn kiểm “đã mua học được” phải seed order + transaction SUCCEEDED bằng SQL (`validate_course_enrollment` đòi order item PAID) → ghi rõ, hoặc 1a chỉ test nhánh “chưa mua → 403” và để ca đã mua cho 1c.
- R2. `CourseContractTest.noPriceOrCurrencyFields` quét mọi DTO course → 1a đổi thành danh sách cho phép (Author/Public) và cấm (Moderator); spec đã nói “theo từng đối tượng”, chỉ cần nêu tên DTO.

**Ngân sách:** trong ngân sách; chỉ X2 đáng cắt.

### Đề xuất ngoài spec (không chặn chốt)

- E1. Nút “Tôi đã chuyển khoản” cho người học: đơn có cờ “đã báo chuyển”, Admin lọc được, khỏi dò sao kê cho mọi đơn PENDING. Công: nhỏ (một cột + một endpoint + một nút). Nên làm ngay trong 1b/2b.
- E2. Người học tự hủy đơn chờ (CANCELLED), để mua lại sau khi giá đổi mà không phải chờ hết hạn. Công: nhỏ. Làm ngay hoặc bỏ.
- E3. Admin xuất CSV đơn PAID theo tháng để đối chiếu sổ sách. Tách sau.

## Trả lời vòng 1 (Codex)

- **S1 — Chấp nhận.** `rg` trên `ErrorCode` xác nhận các mã cũ không tồn tại; dùng `AUTH_ACCESS_TOKEN_REQUIRED`/`AUTH_INVALID_ACCESS_TOKEN` và thêm `ORDER_RATE_LIMITED`, giới hạn 5 request/phút/user kể cả retry.
- **S2 — Chấp nhận.** `ArticleRateLimitService.check(UUID, boolean)` và key `article:rate:` dành cho bài viết; tạo lớp riêng theo mẫu, không sửa caller article.
- **S3 — Một phần.** V1 cho thấy reference duy nhất theo provider, transaction gắn order; reference mới có thể là khoản khác. Đề xuất ghi thêm transaction, một doanh thu/item, một quyền và cảnh báo; chính sách tiền trùng cần người dùng chốt.
- **S4 — Một phần.** Mục 9 `course-payment.directions.md` chưa xác minh retry PayOS. Trả 200 cho webhook đúng chữ ký có bất thường sau khi lưu bền vững; lỗi lưu trả 500, body/chữ ký sai trả 400; ping hoặc không khớp đơn trả 200. Cần xác minh provider trước vận hành.
- **S5 — Một phần.** Mục 9 xác nhận 13 chữ số là giới hạn VietQR, không phải khoảng giá nghiệp vụ hay giới hạn PayOS. Đề xuất 10.000–50.000.000 VND, chờ người dùng chốt.
- **T1 — Một phần.** Đối chiếu luồng MANUAL mục 8–9 với hạn 15 phút cho thấy Admin có thể xác nhận chậm; đề xuất MANUAL 24 giờ và PAYOS 15 phút, chờ người dùng chốt; tiền đến sau vẫn đối chiếu.
- **T2 — Chấp nhận.** `Course.java` map `publishedVersion` tới `published_version_id`; dùng cột khác NULL, bao gồm ẩn/gỡ.
- **T3 — Chấp nhận.** V1 có reference nhưng chưa có audit xác nhận/cờ đối chiếu; bổ sung vị trí audit, nguồn PAYOS không có user, endpoint Admin đóng cờ cùng lỗi/test; khoản mới mở lại cờ.
- **T4 — Một phần.** V1 dùng `ON CONFLICT (order_item_id)` nhưng còn unique active theo user/course; thêm `WHERE NOT EXISTS` dưới khóa user và giữ xử lý conflict item. `CourseEnrollment` ghi chưa có revoke trong code; bỏ yêu cầu mơ hồ về revoke, không mở chức năng revoke.
- **T5 — Chấp nhận.** V1 xác nhận trigger tính lại ở `BEFORE INSERT OR UPDATE`; chặn đổi tỷ lệ policy đã tạo và các trường snapshot item, test UPDATE trực tiếp, vẫn cho đóng policy.
- **T6 — Một phần.** V1 có unique policy active; khóa dòng active có thể đổi trong lúc chờ, nên dùng cùng advisory transaction lock cố định ở cả hai luồng rồi đọc policy sau khi khóa; chụp tại thời điểm tạo item.
- **T7 — Chấp nhận.** `SecurityConfiguration` có `/admin/**` authenticated, các đường order/revenue chưa có và kết thúc `denyAll`; thêm matcher theo method, webhook POST duy nhất permitAll, service kiểm quyền.
- **T8 — Chấp nhận.** `PublishedCourseDetailResponse.Viewer` hiện chỉ có `enrolled`, `canStart`; public detail không chứa đơn chờ, nút Mua gọi POST và mở đơn còn hạn, không cần API tra cứu thêm.
- **X1 — Từ chối.** Mục 9 xác nhận webhook có `orderCode` và `paymentLinkId`, nhưng không chứng minh chữ ký + orderCode đủ thay kiểm link ID hoặc mã lỗi tồn tại luôn khôi phục được `checkoutUrl`. Giữ sự kiện đến sớm bền vững, đối chiếu ID qua response/GET và tra cứu trước retry.
- **X2 — Từ chối.** `PLAN.md` yêu cầu task backend theo thứ tự; 1d có API quản trị, snapshot và đồng thời riêng cần nghiệm thu rõ. Giữ task độc lập, một ca tạo đơn đồng thời đổi policy, không thêm ma trận tích hợp.
- **R1 — Chấp nhận.** `validate_course_enrollment` V1 đòi item PAID cho PURCHASE; 1a kiểm chưa mua và regression miễn phí, ca mua xong học được chuyển sang 1c.
- **R2 — Chấp nhận.** `CourseContractTest` hiện quét toàn bộ request/response; liệt kê DTO Author/Public được phép và Moderator bị cấm, giữ kiểm video URL.
- **E1 — Tách module.** Đã kiểm 1b/1c: Admin có danh sách và xác nhận theo sao kê; cờ tự báo không chứng minh có tiền và thêm API/UI, nên hoãn giữ tiến độ. Chờ người dùng chọn.
- **E2 — Không cần lúc này.** V1 có CANCELLED, nhưng hủy không ngăn chuyển khoản đến muộn; thêm xử lý cạnh tranh và đối chiếu. Chờ người dùng chọn.
- **E3 — Tách module.** 1c có danh sách phân trang; CSV là tiện ích sổ sách riêng, không cần để cấp quyền. Chờ người dùng chọn.

**Điểm yếu còn lại của spec:** khoảng giá, hạn MANUAL và chính sách tiền trùng chưa chốt; 1e còn phụ thuộc kiểm chứng PayOS thực tế (giới hạn tiền, link/tra cứu, retry và webhook). Đối chiếu thủ công phụ thuộc sao kê và Admin; chưa có quy trình xử lý tiền thừa trong sản phẩm. Các quy tắc chờ chốt là đề xuất, không phải quyết định đã được duyệt.

## Phản hồi vòng 2 (Claude)

## Trả lời vòng 2 (Codex)

## Quyết định của người dùng

Chờ người dùng chốt sau phản biện.
