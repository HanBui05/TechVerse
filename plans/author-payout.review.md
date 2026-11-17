# Author payout — lịch sử phản biện

Chuyển từ [`author-payout.md`](author-payout.md) khi người dùng chốt spec 2026-11-16.

## Phản hồi vòng 1 (Codex)

### Đúng

- `earned` khớp `OrderRepository.revenueTotals`: cộng `authorNetAmount` của item thuộc đơn `PAID`, chọn khóa theo `Course.author.id`. V15 giữ `paid_at` đầu khi có khoản chuyển trùng; V16 giữ snapshot tiền của item. Đây không tự chứng minh mọi thao tác DB trực tiếp đều chỉ làm `earned` tăng.
- Task 1d chọn đúng tập bài: `PublishedCourseServiceImpl.tree()` lấy `publishedVersion`, `learning()` giao ID bài trong snapshot với `LessonProgressRepository.findCompleted`; `/me/courses` cũng đếm theo snapshot hiện tại.
- `SecurityConfiguration` có matcher riêng `GET /author/revenue`, `/author/courses/**`, `/admin/**` và `denyAll`; route payout và revenue mới cần matcher. Spec phản ánh đúng quyết định 16/11 trong `course-payment.log.md`: không hoàn tiền, Admin chuyển tay, module này trước PayOS 1e; embedded PayOS và webhook thuộc 1e.

### Sai

1. **QR chi một phần có thể dẫn đến chuyển sai tiền (1b, 2b).** API cố định QR theo toàn bộ `balance` nhưng Sheet cho nhập số nhỏ hơn; Admin có thể quét chuyển toàn bộ rồi ghi một phần. Quy định cách đồng bộ số tiền QR với số tiền thực chuyển khi sửa form, và kiểm chứng số tiền QR/ghi nhận. `OrderService.vietQr` nhúng `amount` vào URL, không tự cập nhật theo form.
2. **Khóa tác giả chưa bảo vệ đổi tài khoản (1a–1b).** `POST` khóa `users` nhưng `PUT` chỉ upsert tài khoản; hai thao tác có thể xen giữa kiểm `accountNo` và chụp snapshot. Quy định cả hai khóa cùng dòng `users` trước khi đọc/ghi tài khoản, giữ tới commit, theo thứ tự nhất quán; kiểm đồng thời đổi tài khoản/ghi chi. `OrderService.confirm` và trigger V15 khóa user người mua rồi order, không phải tài khoản tác giả, nên không thể chỉ nói dùng lại thứ tự đó.

### Thiếu

1. **Retry và tranh reference toàn cục (1b).** Khóa theo tác giả chỉ tuần tự hóa cùng tác giả; hai tác giả khác nhau vẫn có thể cùng chèn `bank_reference` UNIQUE. Quy định xử lý unique sau khi request kia commit thành 409, không thành 500 hoặc trả nhầm do transaction rollback-only; test hai tác giả cùng reference. Test hai request đồng thời cùng tác giả/reference/số tiền trả cùng khoản và chỉ ghi một bản. Sau khóa, kiểm reference/retry/conflict trước số dư và tài khoản: sau lần đầu số dư có thể bằng 0 hoặc tài khoản đã đổi. Làm rõ `accountNo` khác snapshot có còn là retry hay conflict: định nghĩa retry hiện chỉ so ba trường. `OrderService.confirm` kiểm reference trước trạng thái/số tiền và xử lý unique giữa người mua khác.
2. **Bất biến sổ và nhất quán đọc (1a–1c).** Quy định POST sau khóa đọc lại earned và payout trong cùng transaction trước insert; tổng đã chi không vượt earned lúc ghi. Ca hai POST hiện chỉ đảm bảo đúng một thành công nếu từng khoản riêng không vượt số dư ban đầu nhưng tổng vượt; cần nêu dữ liệu này. Nhiều query READ COMMITTED khi đọc revenue/ledger có thể thấy earned và payout từ hai snapshot khác nhau, cho balance âm dù sổ hợp lệ; quy định cách đọc nhất quán và kiểm ca đồng thời tương ứng. V15 khóa buyer rồi cập nhật order: tránh thêm khóa chéo buyer/author tùy tiện gây vòng chờ.
3. **Thông tin chuyển khoản thay đổi (1b, 2b).** So riêng `accountNo` không phát hiện đổi `bankId` hoặc `accountName` khi số không đổi; snapshot có thể khác nơi Admin đã chuyển. Cần kiểm toàn bộ thông tin hoặc phiên bản đã xem. Làm rõ cách xử lý khi đã chuyển thật nhưng tài khoản hoặc số dư đổi trước khi ghi: 409 cùng cấm sửa/xóa hiện chưa cho cách ghi trung thực giao dịch. Đây là quyết định cần người dùng chốt.
4. **API và test chưa phủ bảng nghiệp vụ.** Nêu mã/copy hoặc dẫn luật hiện hành và ca kiểm cho JSON hỏng, phân trang sai/giới hạn, `owedOnly`/`authorId` không hợp lệ, chưa đăng nhập ở route mới, hai PUT đồng thời, biên `amount`/overflow, reference rỗng/quá dài và các tranh chấp trên. Ca 401 có trong kế hoạch 1a nhưng chưa trong “Xong khi”. `accountNo` cho phép chữ nhưng nói “4 số cuối”: thống nhất che bốn ký tự hay chỉ nhận chữ số, kể cả chuỗi đúng bốn ký tự. Quy định ưu tiên lỗi khi nhiều điều kiện cùng sai.
5. **Nguồn học và trạng thái khóa (1d).** Ràng buộc chung nói tác giả thấy nguồn vào học nhưng DTO 1d không trả nguồn; cùng nguồn không thay thế được dữ liệu hiển thị. V1 có `FREE`, `PURCHASE`, `ADMIN_GRANT`; xác định cách trả/hiển thị và xử lý nguồn khác đã tồn tại, hoặc xin người dùng đổi yêu cầu. V12 giữ `published_version_id` cho khóa từng công khai kể cả ẩn/gỡ: quy định dùng snapshot nào ở các trạng thái đó. Thêm ca đổi snapshot, bỏ bài đã hoàn thành và thêm bài, đối chiếu tiến độ người học; định nghĩa `IN_PROGRESS`, trường hợp 0/0, chuẩn hóa `q` và `lastAccessedAt = null`.
6. **Đường dẫn và ranh giới task.** Glob backend đã bao phủ `AuthorCourseService.java`, `CourseSummaryResponse`, `CourseResponse`, `AuthorCourseServiceImpl`, `CourseEnrollmentRepository`, `LessonProgressRepository`. Tuy nhiên chưa nêu tên lớp unit test bộ lọc mới; Task 2c sửa `CourseEditorPage` nhưng không chạy `CourseEditorPage.test.tsx`, Task 2b sửa `AdminSidebar` nhưng cần nêu test trực tiếp của sidebar. Chỉ định test liên quan, không chạy full suite. `ModeratorCourseServiceImpl` còn dùng `CourseResponse` để tạo `ModeratorCourseResponse`, trong khi public dùng `PublishedCourseSummaryResponse`: chỉ rõ giữ contract Moderator/public và regression tương ứng.
7. **Lọc doanh thu (1c, 2a).** `totals` hiện có `itemCount`, không phải số đơn; `paidOrderCount` cần định nghĩa đếm đơn phân biệt khi đơn nhiều item. Danh sách chọn khóa lấy từ endpoint phân trang chỉ có khóa bán trong khoảng lọc: quy định cách chọn khóa ngoài trang đầu và sau khi đổi khoảng ngày. `ledger` và `balanceAmount` phải dùng earned toàn thời gian, không trừ payout khỏi earned đã lọc.

### Thừa / ngân sách kiểm chứng

- Không thấy yêu cầu full backend hoặc full frontend: giới hạn test theo task và CI phù hợp ngân sách. Không cần suite tích hợp mới chỉ cho validation: gom ma trận logic thuần vào unit, giữ integration cho DB/security và đồng thời. Các ca tranh reference, số dư và tài khoản nêu trên cần thiết vì đây là tiền. Kiểm mắt các trang đổi theo dark/light × desktop/mobile nằm trong ngân sách.
- Bổ sung ca cụ thể còn thiếu thay vì yêu cầu full suite hoặc ma trận render toàn `App`.

### Đề xuất ngoài spec (không chặn chốt)

- Không có.

## Trả lời vòng 1 (Claude)

Đã sửa thân spec theo các ý chấp nhận (2026-11-16).

- **Sai 1 — Chấp nhận.** `OrderService.vietQr` nhúng `amount` vào URL nên QR không đổi theo form. Bỏ chi một phần ở giao diện: số tiền ghi nhận cố định bằng số trên QR (số còn nợ lúc mở Sheet), không sửa được. Backend vẫn kiểm `amount ≤ balance`.
- **Sai 2 — Chấp nhận.** `PUT /author/payout-account` khóa cùng dòng `users` trước khi upsert (Task 1a).
- **Thiếu 1 — Chấp nhận.** Task 1b ghi rõ thứ tự: khóa → reference/retry → số dư → `INSERT ... ON CONFLICT DO NOTHING` rồi đọc lại; retry chỉ so `authorId` + `bankReference` + `amount`; thêm ca hai request giống hệt và hai tác giả cùng reference.
- **Thiếu 2 — Một phần.** Chấp nhận: POST đọc lại sau khóa; `earned`/`paidOut` đọc trong một câu SQL (một snapshot ở READ COMMITTED) cho cả màn đọc; nêu dữ liệu ca đồng thời; chỉ khóa một dòng `users` nên không có vòng chờ với `confirm`. Từ chối: test đồng thời cho đường đọc — một câu SQL đã loại nguyên nhân, test thêm vượt ngân sách.
- **Thiếu 3 — Chấp nhận, đổi thiết kế.** `POST` chạy **sau** khi tiền đã chuyển nên 409 vì đổi tài khoản là vô ích: giờ body mang đủ `bankId`/`accountNo`/`accountName` Admin đã chuyển tới, lưu nguyên làm snapshot, trả `accountChanged`. Bỏ `PAYOUT_ACCOUNT_CHANGED`, `PAYOUT_ACCOUNT_REQUIRED`. Ca chuyển thật nhưng vượt số dư (hai Admin cùng chi): giữ 409, xử lý ngoài hệ thống — đưa thành câu hỏi mở 6 cho người dùng.
- **Thiếu 4 — Một phần.** Chấp nhận: 401 vào “Xong khi”; che “4 ký tự cuối”, `accountNo` tối thiểu 6 ký tự; thứ tự ưu tiên lỗi; `owedOnly`/`authorId` sai → `PAYOUT_INVALID`; biên `amount`/reference vào unit test. Từ chối: mã và test riêng cho JSON hỏng/phân trang sai — dùng xử lý chung hiện có (`ArticleFilter`, handler toàn cục), không đổi trong module này.
- **Thiếu 5 — Chấp nhận.** Bỏ “nguồn vào học” khỏi Ràng buộc (mâu thuẫn với DTO); dòng `ADMIN_GRANT` nếu có vẫn hiện như mọi học viên, không hiện nguồn. Khóa ẩn/gỡ vẫn dùng `published_version_id`. Định nghĩa `IN_PROGRESS`, 0/0, `q`, `lastAccessedAt = null`; thêm ca đổi snapshot.
- **Thiếu 6 — Chấp nhận.** Ca lọc sai của 1d nằm trong `CourseStudentsIntegrationTest`; 2c chạy thêm `CourseEditorPage.test.tsx`; 2b chạy test sidebar theo bảng chọn nhanh của `frontend.md`; `CourseContractTest` khẳng định DTO Moderator/công khai không có `studentCount`.
- **Thiếu 7 — Chấp nhận.** `OrderItem` ghi “One course per order” nên dùng `itemCount`, bỏ `paidOrderCount`. Bỏ ô chọn khóa: lọc theo khóa bằng cách bấm dòng ở tab “Theo khóa”. `ledger`/`balanceAmount` luôn toàn thời gian (đã ghi ở Ràng buộc).

**Điểm yếu còn lại của spec:** (1) hai Admin cùng chuyển tiền thật cho một tác giả thì khoản thứ hai không ghi được (câu hỏi mở 6); (2) `bankId` chỉ kiểm định dạng, mã sai làm ảnh QR hỏng chứ không bị chặn; (3) chưa đo hiệu năng query công nợ gộp và đếm tiến độ theo lô với dữ liệu lớn; (4) spec vượt 30 KB cho tới khi chuyển phần phản biện sang `author-payout.review.md` lúc chốt; (5) chưa kiểm V17 có trùng số migration với module khác làm song song.

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)
