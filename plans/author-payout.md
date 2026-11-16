# Author payout, doanh thu chi tiết và học viên của khóa

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết; Codex chỉ ghi vào mục “Phản hồi” (D-030, 2026-11-14).

**Mục tiêu:** (1) Tác giả khai tài khoản ngân hàng nhận tiền, thấy số đã nhận và còn chờ; Admin thấy còn nợ từng tác giả bao nhiêu, quét VietQR dựng sẵn để chuyển khoản rồi ghi nhận khoản chi vào sổ (hệ thống không tự chuyển tiền). (2) Doanh thu xem được chi tiết: tác giả lọc theo khóa/khoảng ngày và xem theo từng khóa; Admin có trang tổng quan doanh thu sàn. (3) Tác giả xem danh sách học viên từng khóa, có lọc.
**Làn:** Đầy đủ · **Rủi ro cao** (Task 1a, 1b): tiền, đồng thời (hai lần ghi chi cùng lúc); code bằng Opus, review vòng 1 dùng `adversarial-review`. Task 1c, 1d và giao diện: rủi ro thường.
**Thứ tự:** 1a → 1b → 1c → 1d → 2a → 2b → 2c. Không có cổng wireframe: các trang dùng lại bố cục `AuthorRevenuePage` và `AdminOrdersPage` (bộ lọc + danh sách + Sheet).

## Đường dẫn thuộc module

Chỉ được sửa các đường dẫn sau. Ngoài danh sách là ngoài phạm vi.

- `server/src/main/resources/db/migration/V17__author_payout.sql`.
- `server/src/main/java/com/techverse/server/{controller,entity,dto,repository,service}/**/*{Payout,Order,Revenue,Course,Enrollment,LessonProgress}*.java`; `server/src/main/java/com/techverse/server/exception/ErrorCode.java`; `server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java`.
- `server/src/test/java/com/techverse/server/course/**` (lớp mới `AuthorPayoutIntegrationTest`, `CourseStudentsIntegrationTest`; sửa `OrderServiceTest`, `CoursePaymentMigrationTest`, `CourseIntegrationTestBase`, `CourseContractTest`); `ArticlePublicationMigrationTest`, `FreeCourseMigrationTest` nếu assertion phiên bản Flyway cần sửa.
- `app/src/types/courses.ts`, `app/src/services/courseService{,.test}.ts`, `app/src/data/{courseI18n,courseI18n.test}.ts`, `app/src/App.tsx`, `app/src/App.courses.test.tsx`.
- `app/src/pages/Author/Revenue/**`, `app/src/pages/Author/Courses/**`, `app/src/pages/Admin/{Payouts,Revenue}/**` (mới), `app/src/components/layout/AdminSidebar.tsx` và test trực tiếp; `app/src/StaffPreferences.test.tsx`, `app/src/components/ui/{sidebar,labels,focus}*.test.*` khi sửa shell.

## Ngoài phạm vi

- Tự động chuyển tiền (API chi hộ của PayOS/ngân hàng); PayOS webhook tự xác nhận tiền vào (Task 1e của `course-payment`, làm sau module này).
- Hoàn tiền (người dùng xác nhận lại 2026-11-16: không có), thu hồi khoản đã chi, sửa/xóa khoản chi đã ghi.
- Khấu trừ thuế, hóa đơn, ngưỡng chi tối thiểu, lịch chi định kỳ, tác giả gửi yêu cầu rút tiền, thông báo/email khi được chi.
- Xác thực chủ tài khoản ngân hàng với ngân hàng; nhiều tài khoản cho một tác giả.
- Biểu đồ, xuất CSV/Excel, so sánh kỳ; tác giả nhắn tin, gỡ hoặc cấp quyền cho học viên; hiện email học viên cho tác giả; Admin/Moderator xem danh sách học viên.

## Ràng buộc

- Được đổi API: Có (endpoint mới + thêm trường vào `GET /author/revenue`, không đổi trường cũ). Được đổi DB: Có, chỉ V17; không sửa V1–V16.
- Giữ nguyên hành vi hiện tại của đơn hàng, xác nhận, hoa hồng.
- **Công thức duy nhất:** `earned` = tổng `order_items.author_net_amount` của đơn `PAID` thuộc khóa của tác giả (đúng query `revenueTotals` hiện có); `paidOut` = tổng `author_payouts.amount`; `balance = earned − paidOut`. Không lưu số dư thành cột. Không có hoàn tiền nên `earned` chỉ tăng; `balance` không bao giờ âm. `earned` và `paidOut` luôn đọc trong một câu SQL.
- Khoản chi là bản ghi bất biến (trigger chặn UPDATE/DELETE như V16). Ghi sai thì Admin xử lý ngoài hệ thống.
- Thông tin ngân hàng chỉ chủ tài khoản và ADMIN đọc được; MODERATOR và API công khai không có trường này. Không log số tài khoản.
- VietQR dùng lại cách dựng URL ở `OrderService.vietQr` (encode query, không gọi mạng ở backend, không gọi thật trong test).
- **Bộ lọc ngày dùng chung:** `from`, `to` dạng `yyyy-MM-dd`, tính cả hai đầu, theo `orders.paid_at` ở múi giờ `Asia/Ho_Chi_Minh`; bỏ trống là không giới hạn. Số tiền lọc theo ngày chỉ áp cho doanh thu; `paidOut`/`balance` luôn là toàn thời gian.
- Tác giả không thấy email, đơn hàng hay số tiền của từng học viên; chỉ thấy tên, ảnh đại diện và tiến độ. Trang doanh thu vẫn không có dữ liệu người mua.

## Task 1a — Tài khoản nhận tiền và số dư của tác giả

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- V17: bảng `author_payout_accounts` (`user_id` PK → `users`, `bank_id varchar(20)`, `account_no varchar(30)`, `account_name varchar(100)`, `updated_at`) và `author_payouts` (`id`, `author_id` → `users` RESTRICT, `amount bigint > 0`, `bank_reference varchar(255)` UNIQUE, snapshot `bank_id`/`account_no`/`account_name`, `created_by` → `users`, `created_at`); trigger chặn UPDATE/DELETE trên `author_payouts`.
- Danh sách ngân hàng hỗ trợ là một hằng số ở backend (mã BIN + tên, khoảng 20 ngân hàng phổ biến; lấy từ danh sách ngân hàng của VietQR lúc làm task, ghi nguồn vào log) và là nguồn duy nhất: `GET /api/v1/author/payout-account` trả `{account, banks}`; `PUT` chỉ nhận `bankId` có trong danh sách.
- `GET /api/v1/author/payout-account` (`account` là `null` khi chưa khai) và `PUT` cùng đường dẫn (tạo hoặc thay), quyền AUTHOR. Chuẩn hóa: `strip`, `accountName` viết hoa. `PUT` khóa dòng `users` của tác giả (`FOR UPDATE`) trước khi upsert, cùng khóa với việc ghi chi ở Task 1b.
- `GET /api/v1/author/revenue`: `Totals` thêm `paidOutAmount`, `balanceAmount`.
- `GET /api/v1/author/payouts` (phân trang, mới nhất trước): `amount`, `bankReference`, `accountNo` che chỉ còn 4 ký tự cuối, `createdAt`.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Body `PUT` | Đúng 3 trường chuỗi; `bankId` phải có trong danh sách ngân hàng hỗ trợ; `accountNo` `^[A-Za-z0-9]{6,30}$`; `accountName` 1–100 ký tự sau `strip` | 400 `PAYOUT_ACCOUNT_INVALID` | Thông tin tài khoản không hợp lệ. |
| Chưa đăng nhập / không phải AUTHOR | Theo luật hiện hành | 401 / 403 `ACCESS_DENIED` | Đăng nhập / không có quyền. |
| Hai `PUT` đồng thời | Upsert theo `user_id`, bản sau thắng, không tạo hai dòng | 200 | — |
| Đổi tài khoản khi còn số dư | Được phép; khoản chi cũ giữ snapshot cũ | 200 | — |

### Kế hoạch thực thi

- **File cần đụng:** V17; entity `AuthorPayout`, `AuthorPayoutAccount`; `OrderRepository` (query tổng đã chi, danh sách khoản chi), `OrderService`, `OrderController`, `AuthorRevenueResponse`, DTO `PayoutResponse`; `ErrorCode`; `SecurityConfiguration`: `/api/v1/admin/**` đã `authenticated()`, nhưng route Author mới (`/author/payout-account` GET+PUT, `/author/payouts`, `/author/revenue/**`) chưa có matcher — dòng hiện tại chỉ có `GET /author/revenue`; phải thêm và có ca test gọi không token → 401.
- **Phần dùng lại:** `revenueTotals` cho `earned`; kiểu đọc body `Map<String,Object>` + kiểm đúng số trường như `confirm`; `ArticleFilter` cho phân trang; `CourseIntegrationTestBase`.
- **Bẫy đã biết:** Hibernate `validate` cần `varchar`, không `char`; V1 tạo trigger audit/`updated_at` từ danh sách bảng động, bảng mới phải tự khai trigger cần thiết; test nào khẳng định phiên bản Flyway mới nhất phải nâng lên 17; `TRUNCATE users CASCADE` trong test xóa luôn hai bảng mới.

### Xong khi

- [ ] `CoursePaymentMigrationTest`: V1→V17 và DB rỗng đạt; UPDATE/DELETE `author_payouts` bị trigger chặn; `amount <= 0` và `bank_reference` trùng bị từ chối.
- [ ] `OrderServiceTest` (unit): bảng kiểm body `PUT` từng dòng biên (độ dài, ký tự, thiếu/thừa trường, sai kiểu) và che số tài khoản.
- [ ] `AuthorPayoutIntegrationTest` (mới, DB/security thật): khai rồi sửa tài khoản; `revenue` trả `balance = earned − paidOut` sau khi chèn khoản chi; tác giả khác và MODERATOR không đọc được tài khoản; `GET payouts` chỉ trả khoản của mình; route Author mới gọi không token → 401.
- [ ] Các lớp trên + `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest` (regression) đạt; full backend do CI.

## Task 1b — Admin xem công nợ và ghi nhận khoản chi

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/admin/payouts/authors?owedOnly=true` (phân trang, nợ nhiều trước): `authorId`, họ tên, email, `earnedAmount`, `paidOutAmount`, `balanceAmount`, `account` (đủ số, hoặc `null`), `vietQr` (tới tài khoản tác giả, số tiền = `balance`, nội dung `TVPAY` + 8 ký tự hex đầu của `authorId` viết hoa; `null` khi chưa có tài khoản hoặc `balance = 0`). `owedOnly=false` trả mọi tác giả từng có doanh thu.
- `GET /api/v1/admin/payouts?authorId=` (phân trang, mới nhất trước; bỏ `authorId` thì mọi tác giả): khoản chi kèm snapshot tài khoản đủ số và Admin ghi nhận.
- `POST /api/v1/admin/payouts` body `{authorId, amount, bankReference, bankId, accountNo, accountName}`. Ba trường tài khoản là nơi Admin **đã chuyển tới** (lấy từ Sheet) và được lưu nguyên làm snapshot: khoản chi ghi lại việc đã xảy ra, nên tài khoản tác giả đổi sau đó không chặn việc ghi. Response có `accountChanged = true` khi tài khoản đã ghi khác tài khoản hiện tại của tác giả.
- Thứ tự xử lý trong một transaction: (1) kiểm body; (2) khóa dòng `users` của tác giả `FOR UPDATE`; (3) tìm khoản chi theo `bankReference`: có và cùng `authorId` + `amount` → trả khoản cũ, có nhưng khác → 409; (4) đọc lại `earned` và `paidOut` bằng **một** câu SQL, `amount > balance` → 409; (5) `INSERT ... ON CONFLICT (bank_reference) DO NOTHING`; chèn 0 dòng (tác giả khác vừa dùng reference đó) → đọc lại và áp bước 3.
- Mỗi transaction chi trả chỉ khóa đúng một dòng `users` (tác giả), không khóa order hay người mua, nên không tạo vòng chờ với `confirm` (khóa người mua rồi order).

### Quy tắc nghiệp vụ và mã lỗi

Thứ tự ưu tiên khi nhiều điều kiện cùng sai: 401/403 → 400 → 404 → quy tắc reference → số dư.

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Body `POST` | Đúng 6 trường; `authorId` UUID; `amount` kiểu Integer/Long > 0 (không số thực, không chuỗi); `bankReference` 1–255 sau `strip`; ba trường tài khoản theo regex Task 1a | 400 `PAYOUT_INVALID` | Thông tin khoản chi không hợp lệ. |
| `owedOnly` không phải boolean, `authorId` (GET) không phải UUID | — | 400 `PAYOUT_INVALID` | Thông tin khoản chi không hợp lệ. |
| JSON hỏng, tham số phân trang sai | Theo xử lý chung hiện có (`ArticleFilter`, handler toàn cục); không thêm mã mới | như hiện hành | — |
| Chưa đăng nhập / không phải ADMIN | — | 401 / 403 `ACCESS_DENIED` | Đăng nhập / Bạn không có quyền. |
| Tác giả không tồn tại | — | 404 `USER_NOT_FOUND` | Không tìm thấy tác giả. |
| Gửi lại cùng `authorId` + `bankReference` + `amount` (kể cả hai request đồng thời, kể cả khi số dư đã về 0 hoặc tài khoản đã đổi) | Trả khoản đã ghi, không chèn thêm | 200 | — |
| `bankReference` đã dùng cho tác giả khác hoặc số tiền khác (kể cả hai tác giả gửi đồng thời) | Không ghi; không thành 500 | 409 `PAYOUT_REFERENCE_CONFLICT` | Mã sao kê này đã được dùng. |
| `amount` > `balance` đọc lại sau khóa (kể cả hai `POST` đồng thời) | Không ghi; tổng đã chi không bao giờ vượt `earned` | 409 `PAYOUT_EXCEEDS_BALANCE` | Số tiền vượt quá số còn phải chi. |
| Tài khoản gửi lên khác tài khoản hiện tại của tác giả | Vẫn ghi theo tài khoản gửi lên | 200, `accountChanged = true` | Tác giả đã đổi tài khoản sau khi bạn mở; khoản chi ghi theo tài khoản bạn đã chuyển. |
| Tác giả bị khóa/mất vai trò AUTHOR nhưng còn số dư | Vẫn hiện trong danh sách và vẫn chi được | 200 | — |

### Kế hoạch thực thi

- **File cần đụng:** `OrderRepository` (query công nợ gộp theo tác giả, khóa dòng user, insert `ON CONFLICT`), `OrderService.recordPayout`, `OrderController`, DTO `AdminPayoutResponse`; `ErrorCode`; tách `vietQr(bankId, accountNo, accountName, amount, content)` từ hàm hiện có để dùng chung.
- **Phần dùng lại:** cách trả kết quả cũ khi gửi lại và `PAYMENT_REFERENCE_CONFLICT` của `OrderService.confirm` làm mẫu (chỉ mẫu: `confirm` khóa người mua, ở đây khóa tác giả).
- **Bẫy đã biết:** không để vỡ UNIQUE thành exception (transaction thành rollback-only), dùng `ON CONFLICT DO NOTHING` rồi đọc lại; `earned` và `paidOut` phải nằm trong một câu SQL (hai subquery, không join nhân dòng) để cùng một snapshot ở READ COMMITTED; `vietqr.*` cấu hình là tài khoản **nền tảng**, QR chi trả phải lấy tài khoản tác giả.

### Xong khi

- [ ] `OrderServiceTest` (unit): bảng kiểm body `POST` từng dòng biên (thiếu/thừa trường, `amount` 0/âm/số thực/chuỗi/vượt Long, reference rỗng và 256 ký tự, tài khoản sai regex); QR chi trả dùng tài khoản tác giả và encode nội dung.
- [ ] `AuthorPayoutIntegrationTest`: ghi chi → `balance` giảm đúng, tác giả thấy trong `GET /author/payouts`; vượt số dư; trùng reference khác số tiền; gửi lại sau khi số dư đã về 0 vẫn trả khoản cũ; tài khoản đổi trước khi ghi → vẫn ghi, `accountChanged = true`, snapshot là tài khoản gửi lên.
- [ ] Ba ca đồng thời: (a) hai `POST` khác reference, mỗi khoản ≤ `balance` nhưng tổng vượt → đúng một thành công, cái kia `PAYOUT_EXCEEDS_BALANCE`; (b) hai `POST` giống hệt → một bản ghi, cả hai 200; (c) hai tác giả cùng reference → một 200, một 409, không 500.
- [ ] `owedOnly` lọc đúng; MODERATOR/AUTHOR gọi ba endpoint Admin nhận 403, không token nhận 401.
- [ ] Lớp trên + `PaymentConfirmationIntegrationTest` đạt; full backend do CI.

## Task 1c — Doanh thu chi tiết cho tác giả và Admin

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/author/revenue` nhận thêm `courseId`, `from`, `to`: `totals` (trừ `paidOutAmount`, `balanceAmount`) và `items` theo bộ lọc. Không tham số thì kết quả như hiện tại.
- `GET /api/v1/author/revenue/courses?from=&to=` (phân trang, doanh thu cao trước): mỗi khóa của tác giả có ít nhất một lượt bán trong khoảng lọc: `courseId`, `courseTitle` (tên hiện tại), `itemCount`, `grossAmount`, `platformAmount`, `authorAmount`.
- `GET /api/v1/admin/revenue?from=&to=` (ADMIN): `totals` (`itemCount`, `grossAmount`, `platformAmount`, `authorAmount` theo bộ lọc), `ledger` toàn thời gian (`earnedAmount`, `paidOutAmount`, `owedAmount` cộng mọi tác giả), và `courses` phân trang như endpoint trên kèm `authorId`, `authorName`.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `from`/`to` | Đúng `yyyy-MM-dd`; `from ≤ to` | 400 `REVENUE_FILTER_INVALID` | Khoảng ngày không hợp lệ. |
| `courseId` | UUID hợp lệ và là khóa của tác giả đang gọi; khóa người khác trả như không tồn tại | 400 `REVENUE_FILTER_INVALID` / 404 `COURSE_NOT_FOUND` | Khoảng ngày không hợp lệ. / Không tìm thấy khóa học. |
| Không có lượt bán trong khoảng lọc | Tổng bằng 0, danh sách rỗng | 200 | — |
| Không phải AUTHOR / ADMIN đúng endpoint | — | 403 `ACCESS_DENIED` | Bạn không có quyền. |

### Kế hoạch thực thi

- **File cần đụng:** `OrderRepository` (thêm điều kiện lọc tùy chọn vào `findRevenue`/`revenueTotals`, query gộp theo khóa, tổng của sàn), `OrderService`, `OrderController`, `AuthorRevenueResponse`, DTO `AdminRevenueResponse`; `ErrorCode`; `SecurityConfiguration`.
- **Phần dùng lại:** điều kiện `o.status = 'PAID'` và snapshot của query doanh thu hiện có; `ledger` dùng đúng hai tổng của Task 1b.
- **Bẫy đã biết:** đổi ngày sang mốc thời gian phải dùng đầu ngày `from` và đầu ngày kế tiếp của `to` theo giờ Việt Nam, không so chuỗi; tổng theo bộ lọc và danh sách phải dùng cùng một điều kiện để không lệch nhau; khóa đã xóa mềm vẫn phải tính doanh thu.

### Xong khi

- [ ] `OrderServiceTest` (unit): phân tích `from`/`to` (sai định dạng, ngược, một đầu trống) và mốc đầu/cuối ngày theo giờ Việt Nam.
- [ ] `OrderIntegrationTest` (thêm ca): lọc theo khóa và theo ngày cho tổng khớp danh sách; đơn trả lúc 23:59 và 00:00 giờ Việt Nam rơi đúng ngày; khóa của tác giả khác trả 404; gộp theo khóa đúng tổng; `admin/revenue` có `ledger.owed = earned − paidOut` và chặn AUTHOR/MODERATOR.
- [ ] Lớp trên + `PaymentConfirmationIntegrationTest`, `AuthorPayoutIntegrationTest` đạt; full backend do CI.

## Task 1d — Học viên của khóa

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/author/courses/{id}/students?q=&progress=&page=&size=` (AUTHOR, chủ khóa): học viên có enrollment còn hiệu lực (`revoked_at IS NULL`), mới vào học trước. Mỗi dòng: `fullName`, `avatarUrl`, `enrolledAt` (`granted_at`), `lastAccessedAt`, `completedLessons`, `totalLessons`. Kèm `summary`: `total`, `notStarted`, `completed` (không theo bộ lọc).
- Bộ lọc: `q` khớp không phân biệt hoa thường một phần họ tên; `q` được `strip`, rỗng coi như không lọc; `progress` = `NOT_STARTED` (`completedLessons = 0`, gồm cả khóa 0 bài) / `IN_PROGRESS` (`0 < completedLessons < totalLessons`) / `COMPLETED` (`totalLessons > 0` và `completedLessons = totalLessons`). `lastAccessedAt` có thể `null`.
- Không có lọc theo nguồn vào học: khóa đã công khai không đổi được miễn phí ↔ trả phí và sản phẩm không tạo `ADMIN_GRANT`, nên mọi học viên của một khóa cùng một nguồn.
- `totalLessons` và `completedLessons` đếm trên các bài của phiên bản đang công khai, cùng cách tính tiến độ người học đang thấy ở `course-free`. Khóa chưa từng công khai: danh sách rỗng. Khóa đang ẩn/gỡ vẫn dùng `published_version_id` còn giữ, học viên vẫn hiện.
- `GET /api/v1/author/courses` và `/{id}`: thêm `studentCount` (enrollment còn hiệu lực).

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Khóa không tồn tại hoặc của tác giả khác | Không lộ sự tồn tại | 404 `COURSE_NOT_FOUND` | Không tìm thấy khóa học. |
| Không phải AUTHOR (kể cả ADMIN/MODERATOR) | — | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| `progress` lạ, `q` dài hơn 100 ký tự | — | 400 `COURSE_STUDENT_FILTER_INVALID` | Bộ lọc không hợp lệ. |
| Enrollment đã thu hồi | Không hiện, không đếm | 200 | — |
| Học viên bị khóa tài khoản | Vẫn hiện (đã vào học) | 200 | — |

### Kế hoạch thực thi

- **File cần đụng:** repository enrollment/course (query danh sách + đếm tiến độ theo lô, không N+1), `AuthorCourseServiceImpl`, `AuthorCourseController`, DTO `CourseStudentResponse`; `CourseResponse`/DTO danh sách của Author thêm `studentCount`; `ErrorCode`.
- **Phần dùng lại:** kiểm chủ khóa của các endpoint `/author/courses/{id}` hiện có; cách xác định tập bài của phiên bản công khai và `LessonProgressRepository` của `course-free`; `ArticleFilter` cho phân trang.
- **Bẫy đã biết:** `CourseContractTest` khóa danh sách trường của DTO, phải cho phép `studentCount` ở DTO Author và **không** có ở DTO Moderator/công khai; `q` phải escape `%`/`_`; tiến độ đếm theo bài của phiên bản công khai, bài đã gỡ khỏi phiên bản không được tính làm `completedLessons > totalLessons`.

### Xong khi

- [ ] `CourseStudentsIntegrationTest` (mới): danh sách đúng học viên (một khóa miễn phí, một khóa trả phí) với tiến độ; `q` và ba giá trị `progress`; `summary` không đổi theo bộ lọc; enrollment thu hồi không hiện; khóa của tác giả khác 404; ADMIN/MODERATOR 403; response không có email.
- [ ] Cùng lớp đó: `progress` lạ và `q` 101 ký tự → 400; `q` chứa `%` không khớp mọi tên; sau khi công khai phiên bản mới bỏ một bài đã hoàn thành và thêm một bài, tiến độ ở đây khớp tiến độ người học thấy ở `/me/courses`.
- [ ] `CourseContractTest` cập nhật; `studentCount` đúng ở danh sách và chi tiết khóa của Author.
- [ ] Lớp trên + lớp tích hợp Author course hiện có (regression) đạt; full backend do CI.

## Task 2a — Tác giả: doanh thu chi tiết, tài khoản nhận tiền, lịch sử chi (giao diện)

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/author/revenue`: thêm hai ô tổng “Đã nhận”, “Chờ chi”; khối “Tài khoản nhận tiền” (xem, nút Sửa mở form: chọn ngân hàng từ danh sách `banks` backend trả, số tài khoản, tên chủ tài khoản); bảng “Lịch sử chi trả” phân trang.
- Chưa khai tài khoản: Alert nhắc khai, có nút mở form.
- Bộ lọc doanh thu: từ ngày, đến ngày, nút Xóa bộ lọc; lọc theo khóa bằng cách bấm một dòng ở tab “Theo khóa”, hiện thành nhãn gỡ được; bộ lọc nằm trên URL. Ba tab: “Lượt bán” (danh sách hiện có), “Theo khóa” (bảng gộp, bấm một khóa thì lọc theo khóa đó), “Chi trả” (tài khoản + lịch sử). Bốn ô tổng cũ đổi theo bộ lọc; hai ô “Đã nhận”, “Chờ chi” ghi rõ là toàn thời gian.

### Quy tắc nghiệp vụ và mã lỗi

Theo bảng Task 1a và 1c. Kiểm client trùng regex backend; `from > to` chặn ở client; lỗi server hiện ở Alert đầu form hoặc đầu trang.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Ô tổng | Đã nhận / Chờ chi | Paid out / Pending payout |
| Chưa khai | Hãy khai tài khoản ngân hàng để nhận doanh thu. | Add a bank account to receive your revenue. |
| Ghi chú | Nền tảng chuyển khoản thủ công; thời gian nhận tùy đợt chi. | Payouts are transferred manually; timing depends on the payout run. |
| Lịch sử rỗng | Chưa có khoản chi nào. | No payouts yet. |
| Lưu xong | Đã lưu tài khoản nhận tiền. | Payout account saved. |
| `PAYOUT_ACCOUNT_INVALID` | Thông tin tài khoản không hợp lệ. | Bank account details are invalid. |
| Tab | Lượt bán / Theo khóa / Chi trả | Sales / By course / Payouts |
| Bộ lọc | Từ ngày / Đến ngày / Xóa bộ lọc / Đang lọc: {course} | From / To / Clear filters / Filtering: {course} |
| Toàn thời gian | Tính trên toàn bộ thời gian, không theo bộ lọc. | All time, not affected by filters. |
| Lọc rỗng | Không có lượt bán nào trong khoảng đã chọn. | No sales in the selected range. |
| `REVENUE_FILTER_INVALID` | Khoảng ngày không hợp lệ. | The date range is invalid. |

### UI

- Bám `docs/design/UI_GUIDE.md`; dùng lại Card/Sheet/NativeSelect/Pagination có sẵn; ô ngày dùng `Calendar` + `Popover` có sẵn; không màu mới. Trạng thái: đang tải, lỗi tải, chưa khai, đã khai, lịch sử rỗng, lọc rỗng. Mobile: ô tổng và bộ lọc xếp dọc, bảng theo khóa thành thẻ, không cuộn ngang, nút ≥ 44px.

### Xong khi

- [ ] `AuthorRevenue.test.tsx`: hiện đúng hai ô mới; chưa khai → Alert + mở form; lưu thành công cập nhật khối; lỗi 400 hiện Alert; lịch sử rỗng và có dữ liệu; đổi bộ lọc gọi API đúng tham số và giữ trên URL; tab Theo khóa bấm khóa thì lọc; `from > to` bị chặn.
- [ ] `courseService.test.ts`, `courseI18n.test.ts`: hàm gọi API mới và mã lỗi mới.
- [ ] Các file test trên + `npm run build` trong `app/` đạt. Kiểm mắt `/author/revenue` dark/light × desktop + mobile một lượt.

## Task 2b — Admin: tổng quan doanh thu và chi trả tác giả (giao diện)

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/admin/revenue` (AdminRoute), mục “Doanh thu” trong nhóm Thanh toán: bộ lọc từ ngày/đến ngày trên URL; bốn ô theo bộ lọc (đơn đã trả, tổng thu, hoa hồng sàn, phần tác giả); ba ô toàn thời gian (tác giả được hưởng, đã chi, còn nợ) có link sang `/admin/payouts`; bảng theo khóa (khóa, tác giả, lượt bán, tổng thu, hoa hồng, phần tác giả) phân trang.

- `/admin/payouts` (AdminRoute), thêm “Chi trả tác giả” vào nhóm Thanh toán của `AdminSidebar`. Danh sách tác giả còn nợ (checkbox “Hiện cả tác giả đã chi đủ”), mỗi dòng: tên, email, đã kiếm, đã chi, còn nợ, nút “Chi trả”.
- Sheet “Chi trả”: thông tin tài khoản + ảnh VietQR + nút sao chép; số tiền cố định bằng số còn nợ lúc mở Sheet (đúng số trên QR, không sửa được) và ô mã sao kê; gửi kèm đúng tài khoản đang hiện trong Sheet; dòng nhắc “Đối chiếu tên chủ tài khoản app ngân hàng hiện ra với tên bên dưới trước khi chuyển” (en: “Check that the account holder shown by your banking app matches the name below before transferring”); bước xác nhận lại trước khi ghi (AlertDialog như xác nhận đơn); dưới cùng là lịch sử chi của tác giả đó. Chưa có tài khoản: không hiện form, hiện thông báo.
- Tab “Lịch sử chi” trên `/admin/payouts`: mọi khoản chi của mọi tác giả, mới nhất trước, phân trang (tác giả, số tiền, mã sao kê, tài khoản nhận, Admin ghi, thời điểm).
- Trang `/admin` của `dashboard-stats` (làm sau) đã có ô doanh thu toàn thời gian và 30 ngày; `/admin/revenue` là trang chi tiết, không thay ô đó.

### Quy tắc nghiệp vụ và mã lỗi

Theo bảng Task 1b. `PAYOUT_EXCEEDS_BALANCE`: hiện Alert và tải lại dữ liệu tác giả trong Sheet. `accountChanged = true`: ghi thành công kèm cảnh báo.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Tiêu đề | Chi trả tác giả | Author payouts |
| Rỗng | Không còn khoản nào phải chi. | Nothing left to pay out. |
| Chưa có tài khoản | Tác giả chưa khai tài khoản nhận tiền. | This author has not added a bank account. |
| Xác nhận | Ghi nhận đã chuyển {amount} cho {name}? Không sửa được sau khi ghi. | Record {amount} paid to {name}? This cannot be edited. |
| Ghi xong | Đã ghi nhận khoản chi. | Payout recorded. |
| `PAYOUT_INVALID` | Thông tin khoản chi không hợp lệ. | Payout details are invalid. |
| `accountChanged` | Tác giả đã đổi tài khoản sau khi bạn mở; khoản chi ghi theo tài khoản bạn đã chuyển. | The author changed their account after you opened this; the payout is recorded against the account you paid. |
| `PAYOUT_EXCEEDS_BALANCE` | Số tiền vượt quá số còn phải chi. | Amount exceeds what is owed. |
| `PAYOUT_REFERENCE_CONFLICT` | Mã sao kê này đã được dùng. | This bank reference is already used. |

### UI

- Dùng lại bố cục và Sheet của `AdminOrdersPage` (480px desktop, toàn màn hình mobile); QR trên nền trắng như trang đơn. Không màu mới. Trạng thái: tải, lỗi, rỗng, QR lỗi vẫn hiện thông tin chuyển khoản.

### Xong khi

- [ ] `AdminPayouts.test.tsx`: danh sách + lọc; mở Sheet thấy QR và tài khoản; ghi thành công cập nhật dòng; từng mã lỗi 409 hiện đúng copy; tác giả chưa có tài khoản không có form.
- [ ] `AdminRevenue.test.tsx`: ô tổng và bảng theo khóa; đổi khoảng ngày gọi API đúng tham số; rỗng; lỗi tải có nút thử lại.
- [ ] `App.courses.test.tsx`: route `/admin/payouts`, `/admin/revenue` chỉ ADMIN; link sidebar; chạy thêm test sidebar theo bảng chọn nhanh của `frontend.md`.
- [ ] Các file test trên + `npm run build` trong `app/` đạt. Kiểm mắt `/admin/revenue`, `/admin/payouts` + Sheet dark/light × desktop + mobile một lượt.

## Task 2c — Tác giả: học viên của khóa (giao diện)

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- `/author/courses/:id/students` (AuthorRoute): tiêu đề khóa, ba ô (tổng học viên, chưa học, đã hoàn thành), bộ lọc (ô tìm tên có debounce, select tiến độ) trên URL, danh sách phân trang: ảnh đại diện, tên, ngày vào học, lần học gần nhất, tiến độ `x/y bài` kèm thanh tiến độ.
- `AuthorCoursesPage`: mỗi khóa hiện số học viên, là link sang trang trên; `CourseEditorPage` có link “Học viên”.

### Quy tắc nghiệp vụ và mã lỗi

Theo bảng Task 1d. 404 hiện trạng thái “không tìm thấy khóa học” với link về danh sách khóa.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Tiêu đề | Học viên | Students |
| Ô tổng | Tổng học viên / Chưa học / Đã hoàn thành | Total students / Not started / Completed |
| Lọc tiến độ | Tất cả / Chưa học / Đang học / Đã hoàn thành | All / Not started / In progress / Completed |
| Tìm | Tìm theo tên học viên | Search by student name |
| Tiến độ | {done}/{total} bài | {done}/{total} lessons |
| Chưa học | Chưa học bài nào | Not started |
| Rỗng | Khóa học chưa có học viên. | This course has no students yet. |
| Lọc rỗng | Không có học viên khớp bộ lọc. | No students match the filters. |
| Số học viên (thẻ khóa) | {count} học viên | {count} students |
| `COURSE_STUDENT_FILTER_INVALID` | Bộ lọc không hợp lệ. | The filters are invalid. |

### UI

- Bám `docs/design/UI_GUIDE.md`; dùng `UserAvatar`, `Badge` (tone qua `toneFor`), `NativeSelect`, `Pagination`, `EmptyState`, `useDebouncedValue` có sẵn; thanh tiến độ dùng token hiện có, không màu mới. Trạng thái: tải, lỗi, rỗng, lọc rỗng, 404. Mobile: mỗi học viên một thẻ, bộ lọc xếp dọc, không cuộn ngang, nút ≥ 44px.

### Xong khi

- [ ] `CourseStudents.test.tsx` (mới, trong `pages/Author/Courses`): danh sách + ba ô; từng bộ lọc gọi API đúng tham số và giữ trên URL; rỗng và lọc rỗng khác copy; 404; không hiện email.
- [ ] `AuthorCoursesPage.test.tsx`: số học viên và link; `CourseEditorPage.test.tsx`: link “Học viên”; `App.courses.test.tsx`: route chỉ AUTHOR.
- [ ] Các file test trên + `npm run build` trong `app/` đạt. Kiểm mắt trang học viên dark/light × desktop + mobile một lượt.

## Quyết định của người dùng

**Người dùng chốt spec 2026-11-16** sau một vòng phản biện của Codex (bỏ vòng 2). Lịch sử phản biện: [`author-payout.review.md`](author-payout.review.md).

1. Luồng tiền: học viên trả qua PayOS (Task 1e của `course-payment`, làm sau module này) → tiền về tài khoản sàn → Admin xem công nợ và chuyển khoản tay cho tác giả, hệ thống ghi sổ. Không tự động chi, không hoàn tiền.
2. Mỗi lần chi toàn bộ số đang nợ (không chi một phần, không ngưỡng tối thiểu); không khấu trừ thuế; khoản chi vượt số nợ do hai Admin cùng chuyển bị từ chối ghi, xử lý ngoài hệ thống.
3. Ngân hàng: khoảng 20 ngân hàng khai ở backend, mã ngoài danh sách bị từ chối; số tài khoản sai do Admin đối chiếu tên chủ tài khoản trước khi chuyển.
4. Thêm vào module: doanh thu chi tiết (Task 1c) và danh sách học viên của khóa có lọc theo tên và tiến độ (Task 1d, 2c); tác giả không thấy email học viên.
5. Không làm wireframe riêng; dùng lại bố cục trang Doanh thu và trang Đơn hàng Admin.
