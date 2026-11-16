# Author payout — nhật ký

## Bắt đầu từ đây (cập nhật 2026-11-16)

- **Task tiếp:** Task 2c (tác giả xem học viên của khóa) · Giao diện: Có; wireframe mục 5 coi là đã duyệt khi người dùng bảo “làm task 2c” · Giao diện: Có
- Task 1a, 1b, 1c, 1d, 2a, 2b đã nhận (2026-11-16; 2a: Codex review vòng 1 sửa xong, kiểm mắt với backend thật đạt); 1b chưa có Codex review (lệnh shell bị chặn tạm thời, người dùng cho commit).
- Wireframe coi là đã duyệt khi người dùng bảo “làm task 2a” (2026-11-16). Sau 2a: 2b → 2c.
- Sau module này: module [`payos-checkout`](payos-checkout.md) (spec chốt 2026-11-16, thay Task 1e của `course-payment`). Repo chưa có cấu hình payOS/ngrok (kiểm 2026-11-16).
- Bẫy kế thừa: `TRUNCATE users CASCADE` trong test xóa luôn `commission_policies` và hai bảng mới; test cần policy phải tự `INSERT ... (rate_bps) VALUES (2000)`.

## Quyết định người dùng chưa có trong spec

- (không có; các quyết định 2026-11-16 đã nằm trong spec)

## Câu hỏi mở cho người dùng

- (không có)

## Task 1b — Kết quả

- API: `GET /admin/payouts/authors?owedOnly=`, `GET /admin/payouts?authorId=`, `POST /admin/payouts`; DTO mới `AdminPayoutResponse` (+ `AuthorBalance` lồng); 3 mã lỗi `PAYOUT_INVALID`, `PAYOUT_REFERENCE_CONFLICT`, `PAYOUT_EXCEEDS_BALANCE`.
- `recordPayout`: kiểm body → khóa `users` tác giả → tra reference (gửi lại / 409) → `revenueTotals` (một câu SQL) → `INSERT ... ON CONFLICT DO NOTHING`, 0 dòng thì đọc lại. `vietQr` tách hàm dùng chung; `payoutQr` dùng tài khoản tác giả, nội dung `TVPAY`+8 hex.
- **Lệch khác spec:** `owedOnly` bỏ trống = `true`; chỉ nhận đúng `true`/`false`. `accountChanged = true` cả khi tác giả chưa khai tài khoản; trong danh sách là `null`. `uuid(...)` dạng chuẩn chuyển vào `OrderService` dùng chung với `courseId` của controller. Không sửa `SecurityConfiguration` (`/admin/**` đã `authenticated()`).
- Test: `./gradlew test` 4 lớp — `OrderServiceTest` 7, `AuthorPayoutIntegrationTest` 9 (gồm 3 ca đồng thời a/b/c), `PaymentConfirmationIntegrationTest` 23, `OrderIntegrationTest` 13: 52/52 đạt. Full backend do CI.
- Chưa kiểm: giao diện (Task 2b).

## Task 1a — Kết quả

- V17 không trùng: không nhánh cục bộ nào có V17+.
- Danh sách ngân hàng: 20 BIN lấy từ `https://api.vietqr.io/v2/banks` ngày 2026-11-16, hằng `OrderService.BANKS` (`{id, name}` = BIN + shortName).
- **Lệch khác spec:** không tạo entity `AuthorPayout`/`AuthorPayoutAccount` — đọc/ghi bằng native query + projection trong `OrderRepository` (như `CommissionPolicyRow`), `revenueTotals` đổi sang native để có subquery `author_payouts` trong cùng câu SQL. Body `PUT` còn từ chối ký tự điều khiển trong `accountName`. Thêm trigger `set_updated_at` cho `author_payout_accounts`. Matcher bảo mật thêm cả `GET /author/revenue/**` (cho 1c).
- Test: `./gradlew test` 7 lớp (`OrderServiceTest`, `CoursePaymentMigrationTest`, `AuthorPayoutIntegrationTest`, `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest`, `FreeCourseMigrationTest`, `ArticlePublicationMigrationTest`) — 64/64 đạt. Full backend do CI.
- Review: Codex `adversarial-review` vòng 1 — approve, không phát hiện; không chạy vòng 2.
- Chưa kiểm: frontend chưa dùng trường mới (Task 2a).

## Nhật ký phiên
### 2026-11-16 — Task 2b đã nhận
- Người dùng nhận Task 2b (2026-11-16); commit cục bộ trên `feature/author-payout`.

### 2026-11-16 — Task 2b kiểm mắt với backend thật
- Playwright MCP + Vite 3000 + backend IntelliJ (đã đặt `VIETQR_*`). Dữ liệu dev tạo thêm: khóa trả phí 350.000 `a1cdd5a1…` của `bao.author` (đã công khai), learner `learner.kiemmat@techverse.test` (mật khẩu `Kiemmat@12345`), đơn `TV000000000001` đã xác nhận qua UI, khoản chi 280.000 mã `FT-CHI-001` (đã ghi qua Sheet).
- Đạt: `/admin/revenue` số khớp (1 đơn, 350.000/70.000/280.000, ledger 280.000 còn nợ); `/admin/payouts` + Sheet 480px dark: QR thật tới tài khoản tác giả, số tiền cố định, ghi chi xong dòng biến mất, lịch sử hiện “Ghi bởi: TechVerse Admin”; light desktop và mobile 390 không cuộn ngang, không chữ tràn.
- **Chưa kiểm:** cảm ứng `pointer: coarse` (trình duyệt báo coarse=false, vùng chạm 44px chưa đo), Calendar mở thật, nhánh lỗi 409/QR lỗi (chỉ có unit test), Sheet mobile toàn màn hình.

### 2026-11-16 — Task 2b Codex vòng 2
- Vòng 2: 1 phát hiện cao — “Số còn nợ hiện tại” có thể sai khi đang tải/lỗi/tác giả sang trang khác. Sửa: chỉ in số khi đã tải xong và tìm thấy tác giả, ngược lại hiện “Số còn nợ đã thay đổi…”; thêm ca test. Revenue + Payouts + courseI18n = 103 đạt, build đạt. Sau vòng 2 không chạy thêm. **Chưa kiểm:** kiểm mắt dark/light × desktop/mobile.

### 2026-11-16 — Task 2b Codex vòng 1 + sửa
- Vòng 1: 1 P1 + 3 P2, đều đúng. Sửa: Sheet giữ snapshot lúc mở, sau `PAYOUT_EXCEEDS_BALANCE` khóa nút ghi và hiện “Số còn nợ hiện tại” (lệch spec “tải lại số trong Sheet”: tránh ghi sổ sai số/tài khoản đã chuyển); doanh thu Admin thay skeleton khi đang tải bộ lọc mới; trang công nợ rỗng ở trang >0 tự về trang 1. Chạy lại Revenue + Payouts + courseI18n + App.courses = 108 đạt, build đạt.

### 2026-11-16 — Task 2b code xong (chưa review, chưa kiểm mắt)
- Mới: `Admin/Revenue/AdminRevenuePage`, `Admin/Payouts/AdminPayoutsPage` (+ test), route `/admin/revenue`, `/admin/payouts`, 2 mục sidebar Thanh toán; service `adminRevenue`/`adminPayouts`, types, 4 mã lỗi (`PAYOUT_INVALID`, `PAYOUT_REFERENCE_CONFLICT`, `PAYOUT_EXCEEDS_BALANCE`, `USER_NOT_FOUND`) + copy vi/en. Dùng lại `useLoad`/`DateField`/`RetryAlert` bằng cách `export` từ `AuthorRevenuePage`.
- Chạy: Revenue + Payouts + App.courses + Sidebar + StaffPreferences + courseI18n + courseService + Author/Revenue = 8 file, 190 đạt; `npm run build` đạt. Lỗi có sẵn: StaffPreferences có Unhandled Rejection `reading 'content'` (có cả trước khi sửa).
- Lệch khác spec: nút “Chi trả” ẩn khi còn nợ = 0; Sheet chỉ hiện trang 1 lịch sử chi của tác giả; `accountChanged` hiện Alert vàng ở trang sau khi Sheet đóng. Chưa kiểm: kiểm mắt dark/light × desktop/mobile, Codex review.

### 2026-11-16 — Task 2a đã nhận
- Người dùng nhận Task 2a (2026-11-16); commit cục bộ trên `feature/author-payout`.

### 2026-11-16 — Task 2a review + kiểm mắt
- Codex vòng 1: một P2 đúng — tổng/hàng cũ còn hiện khi đang tải bộ lọc mới. Sửa: `rev.loading`/`byCourse.loading` thay skeleton cho ô tổng và danh sách; thêm ca test. Chạy lại 4 file test = 138 đạt, build đạt. Không chạy vòng 2 (chỉ 1 sửa nhỏ).
- Kiểm mắt Playwright MCP trên Vite 3000 với **API giả** (backend 8080 không chạy, không tự khởi động): dark desktop 1440 (3 tab, Sheet 480px, lưu xong thấy thông báo), light desktop, mobile 390 (không cuộn ngang, thẻ theo khóa). Sau đó kiểm lại với **backend thật** (IntelliJ, khởi động 17:10; đăng nhập `bao.author@techverse.test` bằng mật khẩu mặc định dev của `application-dev.yaml`, `.env` không đặt): 21 ngân hàng trong form, lưu tài khoản thành công (server viết hoa tên), tab Chi trả hiện tài khoản + “Chưa có khoản chi nào.”, tab Theo khóa/Lượt bán rỗng, lọc ngày rỗng và `from > to` đúng copy, không có response ≥ 400, không lỗi console. Để lại một tài khoản nhận tiền của `bao.author` trong DB dev. **Chưa kiểm:** cảm ứng `pointer: coarse` (vùng chạm 44px), Calendar mở thật, dữ liệu có đơn PAID (DB dev chưa có doanh thu).

### 2026-11-16 — Task 2a code
- `/author/revenue`: ba tab (URL `tab=`), bộ lọc `from/to/courseId/course` trên URL (`Calendar`+`Popover`), 6 ô tổng, khối tài khoản + Sheet form, lịch sử chi. Thêm `revenueByCourse`, `payoutAccount`, `payouts` ở `courseService`; types, copy vi/en, mã lỗi `PAYOUT_ACCOUNT_INVALID`, `REVENUE_FILTER_INVALID`.
- **Lệch khác spec:** tên khóa ở nhãn “Đang lọc” lấy từ tham số URL `course` (backend chỉ nhận `courseId`); đổi sang tab Theo khóa/Chi trả thì xóa lọc khóa (và ngày ở tab Chi trả); `AuthorRevenue.test.tsx` thay ca cũ “không có chữ chi trả” vì giờ có tab Chi trả.
- Test: `AuthorRevenue.test.tsx` (8 ca), `courseService.test.ts`, `courseI18n.test.ts`, `App.courses.test.tsx` = 137 đạt; `npm run build` đạt. TDD đỏ 9 ca đúng lý do (thiếu tính năng). Chưa kiểm mắt, chưa có Codex review.

### 2026-11-16 — Codex review vòng 1 (1c + 1d)
- P1 đúng: `GET /author/revenue` có lọc làm `balanceAmount` = earned đã lọc − paidOut toàn thời gian (sai, có thể âm). Sửa `OrderService.revenue`: khi có lọc, `paidOut`/`balance` lấy từ một câu `revenueTotals` không lọc. P2 đúng (postgres:16-alpine locale C, `lower()` không hạ chữ hoa có dấu): đổi sang `lower(... collate "und-x-icu")`, test `q=đặng` khớp `ĐẶNG Văn`.
- Test lại: `CourseStudentsIntegrationTest`, `AuthorPayoutIntegrationTest`, `OrderServiceTest`, `OrderIntegrationTest` đạt (BUILD SUCCESSFUL); ca balance có lọc đỏ trước khi sửa.

### 2026-11-16 — Task 1d code
- `GET /author/courses/{id}/students?q&progress&page&size` trả `{students: PageResponse, summary{total,notStarted,completed}}`; `studentCount` thêm vào `CourseResponse` và `CourseSummaryResponse` (Author); mã lỗi `COURSE_STUDENT_FILTER_INVALID`. SQL native trong `CourseEnrollmentRepository` (tiến độ đếm bằng subquery theo `course_publication_version_lessons` của phiên bản công khai, không N+1; `q` dùng `strpos(lower())` nên không cần escape `%`/`_`).
- **Lệch khác spec:** test nằm ở `CourseStudentsIntegrationTest` mới như spec; hạn `size` 1–100 và `page` ≥ 0 cũng trả `COURSE_STUDENT_FILTER_INVALID`; khóa chưa công khai trả danh sách rỗng, summary 0; `lower()` không hạ chữ hoa tiếng Việt nếu DB locale C (chưa kiểm).
- Test: `CourseStudentsIntegrationTest` (5), `CourseContractTest`, `AuthorCourseIntegrationTest`, `ModeratorCourseIntegrationTest`, `CourseLearningIntegrationTest` đạt (36 ca ở lượt chạy gộp, sau đó chạy lại lớp mới sau khi sửa test: xanh). TDD đỏ 7/7 đúng lý do. Chưa có Codex review.

### 2026-11-16 — Task 1c code
- `GET /author/revenue` thêm `courseId/from/to`; mới `GET /author/revenue/courses`, `GET /admin/revenue`; mã lỗi `REVENUE_FILTER_INVALID`; `OrderService.range` (ngày VN, [from, to+1)); `findRevenue`/`revenueTotals` nhận bộ lọc, đầu mở dùng mốc 1970/9999 thay vì null.
- **Lệch khác spec:** test tích hợp đặt trong `AuthorPayoutIntegrationTest` (có sẵn `sell`/policy), không phải `OrderIntegrationTest`; `courseId` rỗng coi như không lọc; `courseId` sai UUID → 400 cho `/author/revenue` (`/revenue/courses` không nhận `courseId`); sắp xếp theo gộp `grossAmount` giảm dần.
- Test: `OrderServiceTest`, `AuthorPayoutIntegrationTest`, `PaymentConfirmationIntegrationTest`, `OrderIntegrationTest`: 57/57 đạt (13+13+8+23). Viết code trước khi chạy đỏ (bỏ bước đỏ). Chưa có Codex review.


### 2026-11-16 — Task 1b code
- Admin công nợ + ghi chi (khóa tác giả, idempotent theo reference, chặn vượt số dư); TDD đỏ đúng lý do → xanh; 52 test đạt. Chưa có Codex review (lệnh shell bị chặn). Task 1b đã nhận (2026-11-16).

### 2026-11-16 — Task 1a code
- V17 hai bảng + trigger bất biến; API `GET/PUT /author/payout-account`, `GET /author/payouts`; `revenue.totals` thêm `paidOutAmount`, `balanceAmount`.
- TDD: đỏ đúng lý do → xanh; 64 test đạt. Codex duyệt vòng 1. Task 1a đã nhận (2026-11-16).

### 2026-11-16 — Viết và chốt spec
- Claude viết spec, Codex phản biện một vòng (2 sai, 7 thiếu), Claude sửa thân spec; người dùng chốt, bỏ vòng 2.
