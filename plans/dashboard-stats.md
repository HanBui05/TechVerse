# Dashboard stats — số liệu trang tổng quan Admin và Moderator

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết (D-030); Codex chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Trang tổng quan của Admin và Moderator hiện số đếm thật thay cho khung tĩnh: Admin thấy người dùng, tác giả, nội dung đang công khai, đơn cần xử lý và doanh thu; Moderator thấy số việc đang chờ ở từng hàng đợi. Số liệu được trình bày bằng các ô và biểu đồ phân bổ.
**Làn:** Đầy đủ · **Rủi ro:** thường. Review vòng 1 dùng `review`.
**Thứ tự:** Task 1 (Backend) → Task 2 (Giao diện) → Task 2b (biểu đồ). **Làm sau cùng**, khi các module khác đã code xong (T6 A).
**Nguồn quyết định:** câu T6 trong [`roadmap.questions.md`](roadmap.questions.md) (người dùng trả lời 2026-11-14): chỉ số đếm, làm cuối; doanh thu chỉ Admin thấy, Moderator chỉ thấy số đếm nội dung/báo cáo.

## Hiện trạng đã đối chiếu (2026-11-15)

- `AdminDashboardPage` chỉ có bốn ô lối tắt tĩnh, không gọi API (`app/src/pages/Admin/AdminDashboardPage.tsx`). `ModeratorDashboardPage` hiện năm ô số liệu bài viết bằng cách gọi năm lần API danh sách với `size=1` (`useArticleStats`, `app/src/pages/Moderator/ArticleStats.tsx:23`–`37`) và một thẻ dẫn tới hàng đợi bài viết.
- Chưa có endpoint tổng hợp số liệu nào. Doanh thu nằm ở `orders` (`status`, `paid_at`) và `order_items` (`unit_price_amount`, `commission_amount`, `author_net_amount`; CHECK tổng hai phần bằng giá) — `V1__initial_schema.sql`, bảng `orders`, `order_items`.
- Các bảng nguồn khác: `users.is_active`, `author_profiles.status`, và bảng nội dung của từng module (`articles`, `courses`, `exercise_sets`, `interview_questions`, `forum_posts`, `reports`). Bốn module sau **chưa được code**; spec của chúng đã chốt.

## Đường dẫn thuộc module

- `server/src/main/java/com/techverse/server/{controller,dto,repository,service}/**/*Dashboard*.java` (tạo); `configuration/SecurityConfiguration.java` (thêm matcher authenticated cho `/api/v1/moderator/dashboard`; đường Admin đã được matcher hiện có phủ).
- `server/src/test/java/com/techverse/server/dashboard/{DashboardControllerTest,DashboardServiceTest,DashboardIntegrationTest}.java` (tạo).
- `app/src/components/DashboardCharts.tsx`, `app/src/components/ui/chart.tsx`, `app/src/styles/tokens.css`, `app/package.json`, `app/package-lock.json`; [wireframe](dashboard-stats.wireframe.md).
- `app/src/pages/Admin/AdminDashboardPage.tsx`, `app/src/pages/Moderator/ModeratorDashboardPage.tsx` và test của hai trang; `app/src/{types/dashboard.ts,services/dashboardService.ts,data/dashboardI18n.ts}` và test (tạo).

## Ngoài phạm vi

- Số liệu theo thời gian, xuất file, lọc theo khoảng ngày tùy chọn, so sánh kỳ trước.
- Trang tổng quan cho Tác giả và người học (doanh thu tác giả đã có ở `course-payment`).
- Bộ nhớ đệm, bảng tổng hợp, tác vụ nền tính trước; số liệu AI (lượt dùng, chi phí); số liệu nhắn tin.
- Sửa repository, entity hay API của module khác.

## Ràng buộc chung

- Được đổi API: Có (thêm hai endpoint chỉ đọc). Được đổi DB: Không. Giữ nguyên hành vi hiện tại: Có — các ô lối tắt của Admin và thẻ hàng đợi của Moderator vẫn còn; `ArticleStats` trên trang hàng đợi bài viết không đổi.
- **Mỗi chỉ số chỉ được đưa vào khi phần nguồn của nó đã có trong code lúc làm task này**, xét theo từng task nguồn chứ không theo tên module (bảng “Phụ thuộc” ở Task 1). Phần nguồn chưa có: **bỏ hẳn khóa đó khỏi JSON** (không `null`, không 0) và bỏ ô khỏi giao diện; một nhóm không còn trường nào thì bỏ cả nhóm; ghi “Lệch khác spec” trong log. Số 0 chỉ có nghĩa là “có nguồn và đếm được 0”.
- Mọi nguồn đã có khi thực hiện Task 1 nên API trả đủ các khóa; không triển khai logic bỏ nhóm rỗng (xem log).
- Điều kiện đếm lấy từ code của phần nguồn khi đã có, đối chiếu với spec đã chốt của phần đó; hai bên khác nhau thì theo code và ghi lệch vào log.
- Mỗi endpoint tính bằng các câu đếm đọc trực tiếp, không lưu đệm. Thời điểm tham chiếu cho các mốc “7 ngày”, “30 ngày” lấy **một lần** cho cả request. **Không hứa các số là một ảnh chụp nhất quán**: mỗi số đúng tại lúc câu đếm của nó chạy, các số có thể lệch nhau vài thao tác khi dữ liệu đang đổi.
- Truy vấn đếm viết riêng trong `DashboardRepository` (SQL chỉ đọc), không thêm phương thức vào repository của module khác.
- Doanh thu **không bao giờ** có trong API và giao diện của Moderator. Tài khoản vừa ADMIN vừa MODERATOR thấy doanh thu ở trang Admin.
- Tiền là số nguyên VND, truyền dạng số JSON; giới hạn hỗ trợ là 2^53 − 1 (số nguyên chính xác của JavaScript, khoảng 9 triệu tỷ đồng). Tổng vượt giới hạn này thì trả lỗi máy chủ và ghi log thay vì trả số sai. “7 ngày qua”/“30 ngày qua” là khoảng trượt: lớn hơn thời điểm tham chiếu trừ đúng 7 hoặc 30 ngày, tới thời điểm tham chiếu.
- Hai endpoint chỉ đọc, không có body, không có đối tượng sở hữu, không gọi dịch vụ ngoài, không ghi: các nhóm ngoại lệ “dữ liệu gửi lên sai”, “không phải chủ sở hữu”, “ghi trùng”, “lỗi dịch vụ ngoài” không áp dụng. Tham số query lạ bị bỏ qua.

## Task 1 — API số liệu

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `GET /api/v1/admin/dashboard` (chỉ ADMIN) trả:
  - `users`: `total` (mọi dòng `users`, mọi role), `active` (`is_active = true`), `locked` (`is_active = false`), `newLast7Days` (theo `users.created_at`).
  - `authors`: `approved`, `suspended`, `pendingApplications` — đếm dòng `author_profiles` theo `status` (APPROVED, SUSPENDED, PENDING), không xét tài khoản có bị khóa hay không.
  - `content`: số nội dung **ở trạng thái công khai**, tính theo trạng thái của chính nội dung, **không xét tác giả còn hiển thị hay không** (nên có thể lớn hơn số người đọc thấy khi có tác giả bị đình chỉ/khóa): `articles`, `courses` (theo trục công khai của hai module đó), `exerciseSets`, `interviewQuestions` (`status = PUBLISHED`), `forumQuestions` (`parent_id IS NULL` và `status = VISIBLE`).
  - `orders`: `awaitingConfirmation` (đơn có cờ người học đã báo chuyển khoản và đang `PENDING` hoặc `EXPIRED`; đơn đã `PAID`, `FAILED`, `CANCELLED` không tính), `needsReconciliation` (đơn đang bật cờ đối chiếu).
  - `revenue.allTime` và `revenue.last30Days` (theo `orders.paid_at`): `paidOrders` (số **đơn** `PAID` phân biệt), `grossAmount`, `platformAmount`, `authorAmount` (cộng `unit_price_amount`, `commission_amount`, `author_net_amount` của các item thuộc những đơn đó). Chỉ đi từ `orders` sang `order_items`, **không nối bảng giao dịch thanh toán**, nên một đơn có hai khoản chuyển vẫn tính một lần; hai đơn `PAID` riêng cho cùng một khóa là hai lần thu thật và tính cả hai — đúng quy tắc của `course-payment` Task 1c.
- `GET /api/v1/moderator/dashboard` (chỉ MODERATOR) trả đúng hai nhóm, không có khóa nào khác:
  - `pending`: `articles`, `courses`, `exerciseSets`, `interviewQuestions` (số mục đang chờ duyệt, cùng điều kiện với bộ lọc “Chờ duyệt” của từng hàng đợi).
  - `reports`: `open` (báo cáo `OPEN`), `hiddenPosts` (mọi bài diễn đàn đang `HIDDEN`, cả bài hỏi lẫn câu trả lời).
- Không có tham số đầu vào.

**Phụ thuộc (khóa JSON → phần nguồn phải có trong code):** `users`, `authors`, `content.articles`, `content.courses`, `pending.articles`, `pending.courses` → đã có. `orders.awaitingConfirmation` → `course-payment` 1b; `orders.needsReconciliation`, `revenue.*` → `course-payment` 1c. `content.exerciseSets`, `pending.exerciseSets` → `exercise-practice` 1a (trạng thái) và 1b (hàng đợi). `content.interviewQuestions`, `pending.interviewQuestions` → `interview-practice` 1a/1b. `content.forumQuestions` → `forum-reports` 1a; `reports.*` → `forum-reports` 1b.

### Quy tắc nghiệp vụ và mã lỗi

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| Thiếu token / token sai | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để tiếp tục. |
| Gọi API Admin khi không có role ADMIN (kể cả tài khoản chỉ MODERATOR) | — | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Gọi API Moderator khi không có role MODERATOR (kể cả ADMIN không kèm MODERATOR) | — | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Tài khoản có cả ADMIN và MODERATOR | Gọi được cả hai endpoint; doanh thu chỉ có ở phản hồi của endpoint Admin | 200 | — |
| Tham số query lạ | Bỏ qua | 200 | — |
| Tài khoản bị khóa | Kiểm người dùng đang hoạt động như các API quản trị hiện có | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Không có dữ liệu | Mọi số là 0, tiền là 0; không trả `null` | 200 | — |
| Số liệu đổi trong lúc đang tính (đơn vừa được xác nhận, bài vừa được duyệt) | Mỗi số đúng tại lúc câu đếm của nó chạy; các số có thể lệch nhau vài thao tác; không hứa nhất quán giữa các số | 200 | — |
| Lỗi cơ sở dữ liệu ở bất kỳ câu đếm nào | Theo xử lý lỗi chung; trả lỗi cho cả request, không trả số liệu dở dang | 500 theo `ErrorResponse` hiện có | Không tải được số liệu. Hãy thử lại. |
| Tổng tiền | Cộng chính xác, không dùng số thực; vượt 2^53 − 1 thì trả lỗi thay vì số sai | 200 / 500 | — / Không tải được số liệu. Hãy thử lại. |

### Kế hoạch thực thi

Task đã nhận; chi tiết thực hiện và kiểm chứng xem [log](dashboard-stats.log.md).

### Xong khi

- [x] `DashboardControllerTest` (`@WebMvcTest`): 401 thiếu token và token sai, mapping 403; **toàn bộ cấu trúc JSON của Moderator đúng bằng hai nhóm `pending`, `reports` với các khóa con đã liệt kê, không có khóa nào khác ở bất kỳ tầng nào**; trường vắng không xuất hiện dưới dạng `null`; tham số query lạ bị bỏ qua.
- [x] `DashboardServiceTest` (unit, repository giả): một câu đếm lỗi → cả request lỗi, không trả dở dang; tổng tiền vượt 2^53 − 1 → lỗi; `SUM` rỗng → 0.
- [ ] Nhóm không còn trường nào thì bị bỏ (chưa kiểm — xem log; mọi nguồn đã có, không triển khai logic này).
- [x] `DashboardIntegrationTest` (DB/security thật, gộp theo luồng): (1) cơ sở dữ liệu trống → mọi số bằng 0; (2) dữ liệu mẫu cho các chỉ số đã có nguồn → số đúng, gồm ca tác giả bị đình chỉ vẫn được tính ở `content`, biên 7 ngày của người dùng mới, và `pending.articles`, `pending.courses` bằng `totalElements` của hai API hàng đợi tương ứng; (3) doanh thu (khi `course-payment` 1c đã có): đơn hết hạn chưa trả không tính, một đơn `PAID` có hai giao dịch tính một lần, hai đơn `PAID` cho cùng khóa tính cả hai, `platformAmount + authorAmount = grossAmount`, biên 30 ngày theo `paid_at`, đơn đã báo chuyển khoản ở `PENDING`/`EXPIRED` được tính còn `PAID` thì không; (4) quyền: chỉ MODERATOR gọi API Admin → 403, ADMIN đơn vai gọi API Moderator → 403, tài khoản hai vai gọi được cả hai, tài khoản bị khóa → 403 ở cả hai.
- [x] Chạy ba lớp trên (cần Docker); full backend do CI chạy khi mở PR.

## Task 2 — Giao diện hai trang tổng quan

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Trang Admin (`/admin`): thêm khu “Số liệu” phía trên các ô lối tắt, gồm bốn nhóm ô: Người dùng, Tác giả, Nội dung đang công khai, Đơn hàng và doanh thu (doanh thu hiện hai dòng: toàn thời gian và 30 ngày qua; mỗi dòng có số đơn đã thanh toán, tổng thu, nền tảng giữ, tác giả nhận). Ô “Hồ sơ chờ duyệt”, “Đơn chờ xác nhận”, “Đơn cần đối chiếu” là liên kết tới **route của trang tương ứng** (hồ sơ tác giả, đơn hàng Admin).
- Trang Moderator (`/moderator`): thay khối năm ô bài viết bằng các ô “đang chờ” của từng hàng đợi (bài viết, khóa học, bài tập, câu hỏi phỏng vấn, báo cáo vi phạm, nội dung đang ẩn), mỗi ô là liên kết tới route của hàng đợi đó; giữ thẻ hàng đợi hiện có.
- Liên kết **không cam kết lọc sẵn** ngoài bộ lọc mặc định của trang đích (các trang hồ sơ tác giả và hàng đợi hiện giữ bộ lọc trong state, không đọc URL, và mặc định vốn là “chờ duyệt”/“chờ xử lý”). Chỉ thêm tham số lọc vào liên kết khi trang đích lúc đó đã đọc bộ lọc từ URL (ví dụ tab của `/moderator/reports`); không sửa trang đích trong task này. Liên kết chỉ hiện khi route đích đã tồn tại; chưa có thì ô là ô thường.
- Một lần gọi API cho mỗi trang khi mở; có nút “Tải lại”. Đang tải hiện khung chờ; lỗi thì các ô hiện “—” kèm thông báo và nút thử lại, phần còn lại của trang vẫn dùng được.
- Ô của module không có trong phản hồi API thì không hiển thị.
- Wireframe được duyệt trước khi code: [`dashboard-stats.wireframe.md`](dashboard-stats.wireframe.md), gồm 5 điều chỉnh tại mục 4: copy đầy đủ; skeleton chỉ thay số; tải lại giữ số cũ và chỉ nhận lượt mới nhất; doanh thu desktop dùng bảng có `th scope`, mobile dùng `dl`, ẩn đúng kỳ/trường thiếu; ô lẻ mobile chiếm nửa hàng.
- Liên kết đơn hàng: `/admin/orders?status=ALL&transferReported=true` và `/admin/orders?status=ALL&needsReconciliation=true`; `ALL` không giấu đơn hết hạn và có thể bao gồm đơn đã xử lý.

### Kế hoạch thực thi

Task đã nhận; chi tiết thực hiện và kiểm chứng xem [log](dashboard-stats.log.md).

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Tiêu đề khu | Số liệu | Overview |
| Tiêu đề nhóm | Người dùng / Tác giả / Nội dung đang công khai / Đơn hàng và doanh thu | Users / Authors / Public content / Orders and revenue |
| Người dùng | Tổng người dùng / Đang hoạt động / Đã khóa / Mới trong 7 ngày | Total users / Active / Locked / New in 7 days |
| Tác giả | Tác giả đã duyệt / Tác giả bị đình chỉ / Hồ sơ chờ duyệt | Approved authors / Suspended authors / Pending applications |
| Nội dung | Bài viết / Khóa học / Bộ bài tập / Câu hỏi phỏng vấn / Câu hỏi diễn đàn | Articles / Courses / Exercise sets / Interview questions / Forum questions |
| Đơn hàng | Đơn chờ xác nhận / Đơn cần đối chiếu | Orders awaiting confirmation / Orders to reconcile |
| Doanh thu | Doanh thu / Toàn thời gian / 30 ngày qua / Đơn đã thanh toán / Tổng thu / Nền tảng giữ / Tác giả nhận | Revenue / All time / Last 30 days / Paid orders / Gross / Platform share / Author share |
| Moderator | Bài viết chờ duyệt / Khóa học chờ duyệt / Bộ bài tập chờ duyệt / Câu hỏi phỏng vấn chờ duyệt / Báo cáo chờ xử lý / Nội dung đang ẩn | Articles pending / Courses pending / Exercise sets pending / Interview questions pending / Open reports / Hidden content |
| Hành động | Tải lại / Thử lại | Refresh / Retry |
| Lỗi | Không tải được số liệu. Hãy thử lại. | Could not load the numbers. Try again. |

### UI

- Theo `UI_GUIDE.md`; primitive và token hiện có, không thêm màu mới (dùng các tone đã có của ô lối tắt và `ArticleStats`). Lưới 2 cột ở mobile 390px, tăng dần ở màn rộng; số tiền dài không tràn ô; mỗi ô liên kết có vùng chạm 44px và tên truy cập đọc được cả nhãn lẫn số.

### Xong khi

- [x] `dashboardI18n`/định dạng (unit): số và tiền theo vi/en, “—” khi thiếu số.
- [x] `AdminDashboardPage.test.tsx`: trạng thái đang tải; hiện đủ số từ API (gồm số đơn ở doanh thu); liên kết của ba ô việc cần xử lý; lỗi tải → “—” + thử lại thành công; thiếu một nhóm và thiếu một trường con trong phản hồi → không có ô đó; bấm “Tải lại” hai lần, phản hồi cũ về sau không ghi đè phản hồi mới; đổi ngôn ngữ; các ô lối tắt cũ vẫn còn.
- [x] `ModeratorDashboardPage.test.tsx`: hiện số chờ của từng hàng đợi và liên kết; **không có** chữ hay số doanh thu; lỗi tải; chỉ gọi một API số liệu (không còn năm lần gọi cũ).
- [x] Chạy đúng các file test trên và `dashboardService.test.ts` theo cách chạy test theo file của `frontend.md`, cùng `npm run build` trong `app/` (không chạy full `npm test`).
- [x] Kiểm bằng mắt: dark/light × desktop/mobile, một lượt; ghi log.

- [ ] Kiểm hai trang với API dashboard thật (chưa kiểm — xem log).

## Task 2b — Khu “Phân bổ”

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có · Đã nhận 2026-11-24. [Wireframe mục 5](dashboard-stats.wireframe.md) đã duyệt.

### Phạm vi

- Dùng response dashboard đã tải, không gọi thêm API hay đổi backend; giữ ô số. Admin đặt “Phân bổ” trước “Khu vực quản trị”: nội dung công khai theo loại (cột ngang giảm dần), tài khoản (thanh chia người dùng và tác giả), doanh thu 30 ngày qua (tỷ lệ tổng thu 30 ngày / toàn thời gian). Moderator đặt biểu đồ việc chờ theo hàng đợi và báo cáo trước thẻ hàng đợi; không gồm nội dung đang ẩn.
- Dùng shadcn `chart` trên Recharts. Thêm `--chart-1..3` trong `tokens.css`: light `#1d4ed8`, `#92400e`, `#7e22ce`; dark `#3b82f6`, `#d97706`, `#a855f7`. Chi tiết bố cục, copy, trạng thái, dữ liệu thiếu và khả năng truy cập theo wireframe mục 5.
- Tải lần đầu dùng skeleton; tải lại giữ dữ liệu cũ; lỗi ẩn khu biểu đồ; thiếu trường thì bỏ hàng/thanh tương ứng; tất cả giá trị bằng 0 hiện “Chưa có dữ liệu.” / “No data yet.”.

### Kế hoạch thực thi

Task đã nhận; chi tiết thực hiện và kiểm chứng xem [log](dashboard-stats.log.md).

### Xong khi

- [x] Chạy test các file dashboard và test UI liên quan cùng `npm run build`; ba ca mới cho biểu đồ (kết quả xem log).
- [x] Kiểm mắt dark/light × desktop/mobile: nhãn và số không bị cắt, không cuộn ngang; kiểm thêm nhãn số lớn và số 0 (dùng dữ liệu mẫu, xem log).
- [ ] Kiểm biểu đồ với số thật từ API (chưa kiểm — xem log).

## Câu hỏi mở cần người dùng chốt

- (không có — sáu câu hỏi mở đã chốt giữ mặc định, xem mục dưới)

## Quyết định của người dùng

**Người dùng chốt spec 2026-11-15** (Task 1, Task 2). Lịch sử phản biện: [`dashboard-stats.review.md`](dashboard-stats.review.md).

- Quyết định ban đầu được cập nhật: có wireframe được duyệt và Task 2b biểu đồ theo quyết định 2026-11-23–24; không lưu đệm, có nút “Tải lại”; nguồn chưa có thì bỏ ô, không hiện số 0.
- Phần Claude sửa thân spec sau vòng 1 chưa qua Codex soát vòng 2.
