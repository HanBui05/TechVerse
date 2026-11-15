# Dashboard stats — lịch sử phản biện

Chuyển nguyên từ `dashboard-stats.md` khi chốt spec (2026-11-15). Không cần đọc khi code.

## Phản hồi vòng 1 (Codex)

### Đúng

- **Đúng — hiện trạng và phân quyền theo vai trò:** Admin hiện có bốn lối tắt (`app/src/pages/Admin/AdminDashboardPage.tsx:8`); Moderator gọi năm lần lấy số và dùng số đầu cho thẻ hàng đợi (`app/src/pages/Moderator/ArticleStats.tsx:13`, `:25`–`:36`; `app/src/pages/Moderator/ModeratorDashboardPage.tsx:11`–`:25`), test hiện kiểm năm lần gọi (`app/src/pages/Moderator/ModeratorDashboardPage.test.tsx:12`–`:28`). Service hiện kiểm cả tài khoản hoạt động và đúng role, không mặc định ADMIN có quyền MODERATOR (`server/src/main/java/com/techverse/server/service/impl/ModeratorArticleServiceImpl.java:226`; `server/src/main/java/com/techverse/server/service/impl/AdminAuthorApplicationServiceImpl.java:138`). Matcher Admin đã phủ, nhưng Moderator dashboard cần matcher mới vì chỉ có matcher articles/courses và cuối cùng `denyAll` (`server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java:78`–`:95`).
- **Đúng — nguyên tắc doanh thu:** tính từ item của đơn PAID, không nhân theo giao dịch, phù hợp quyết định thanh toán trùng (`plans/course-payment.md:116`–`:120`, `:333`); V1 lưu ba số tiền snapshot, ràng buộc hai phần bằng giá (`server/src/main/resources/db/migration/V1__initial_schema.sql:307`–`:326`). Doanh thu chỉ Admin được xem đúng quyết định T6 (`plans/roadmap.questions.md:267`).
- **Đúng — không dùng schema làm bằng chứng tính năng đã có:** các bảng tồn tại nhưng API bài tập, phỏng vấn, diễn đàn, thanh toán chưa có (`docs/PROJECT_CONTEXT.md:14`); cơ chế bỏ trường/ô thay vì số 0 giả là cần thiết (`plans/dashboard-stats.md:32`). Template yêu cầu đường dẫn, phạm vi, bảng lỗi và tiêu chí kiểm chứng (`plans/_template.md:10`–`:43`, `:65`); spec có đủ các mục ở mức cấu trúc.

### Sai

1. **“Đang công khai” không xét tác giả làm số sai so với nhãn và trang người học.** Spec loại điều kiện tác giả (`plans/dashboard-stats.md:47`) nhưng bài tập và phỏng vấn công khai chỉ trả `PUBLISHED` của tác giả còn hiển thị (`plans/exercise-practice.md:115`, `plans/interview-practice.md:42`, `:110`); bài viết/khóa học cũng dùng quy tắc hiển thị riêng (`server/src/main/java/com/techverse/server/repository/specification/PublishedArticleSpecification.java:20`–`:32`). Đặc biệt tiêu chí so `totalElements` (`plans/dashboard-stats.md:77`) không thể đồng thời đạt nếu có tác giả bị đình chỉ/khóa. Cần chọn đếm thực sự nhìn thấy theo API công khai, hoặc đổi nhãn thành trạng thái công khai và không so với API công khai; bổ sung ca tác giả mất điều kiện.
2. **Đơn chờ xác nhận và bộ lọc nguồn không tương đương như mô tả.** Spec dashboard chỉ nói đơn chờ thanh toán đã báo (`plans/dashboard-stats.md:48`), trong khi báo chuyển khoản hợp lệ cả `PENDING` và `EXPIRED`, cờ không thay trạng thái (`plans/course-payment.md:80`, `:94`); bộ lọc `transferReported=true` không tự giới hạn trạng thái (`plans/course-payment.md:116`). Cần định nghĩa tập đếm chính xác, gồm quyết định với đơn hết hạn và đã PAID, và bộ lọc khi mở trang phải cùng tập đó.
3. **“Ảnh chụp tại thời điểm gọi” mâu thuẫn với cho phép mỗi câu thấy một thời điểm (`plans/dashboard-stats.md:33`, `:64`).** Transaction chỉ đọc không tự bảo đảm snapshot chung; cần chọn một semantics, mô tả mức cách ly nếu yêu cầu snapshot, hoặc ghi rõ số có thể lệch và không hứa lần sau chắc chắn khớp khi dữ liệu còn thay đổi.

### Thiếu

1. **Định nghĩa và biên từng chỉ số:** xác định `total` gồm mọi role/tài khoản hay không, `active` là `is_active=true`, `newLast7Days` theo `users.created_at` và hai đầu khoảng; tác giả đếm hồ sơ theo từng status và có tính tài khoản bị khóa không (`server/src/main/resources/db/migration/V1__initial_schema.sql:14`–`:24`, `:82`–`:97`). Xác định bài hỏi `parent_id IS NULL` và `status=VISIBLE`, `hiddenPosts` tính cả câu trả lời hay không (`server/src/main/resources/db/migration/V1__initial_schema.sql:522`–`:537`; `plans/forum-reports.md:110`–`:112`). Chỉ rõ `paidOrders` là số đơn phân biệt, tiền tổng hợp item từng đơn, biên 30 ngày theo cùng một thời điểm tham chiếu; tránh nhân item khi join giao dịch (`plans/course-payment.md:118`–`:119`).
2. **Tính sẵn sàng theo task nguồn, không chỉ tên module:** `course-payment` chia 1b (cờ báo), 1c (xác nhận/đối chiếu/doanh thu), 2c (trang Admin) (`plans/course-payment.md:77`–`:80`, `:110`–`:120`, `:289`–`:295`); module có thể mới có một phần. Cần quy định từng trường phụ thuộc backend nào, từng link phụ thuộc UI nào, hình dạng JSON khi thiếu một trường, toàn bộ nhóm hoặc cả nhóm cha; tránh nhầm số 0 hợp lệ với trường vắng và trạng thái lỗi trước phản hồi (`plans/dashboard-stats.md:32`, `:63`, `:88`–`:89`). Chỉ dùng code nguồn khi đã có, đối chiếu spec đã chốt và ghi lệch nếu khác, thay vì để code tương lai tự quyết nghiệp vụ (`plans/dashboard-stats.md:71`).
3. **Link lọc sẵn chưa đủ khả thi trong phạm vi file:** trang hồ sơ hiện giữ `status` trong state, mặc định PENDING, không đọc URL (`app/src/pages/Admin/AuthorApplicationsPage.tsx:42`–`:50`); trang bài viết Moderator cũng dùng state (`app/src/pages/Moderator/ModeratorArticlesPage.tsx:30`–`:37`). Các trang đơn/bài tập/phỏng vấn còn phụ thuộc code tương lai (`plans/course-payment.md:295`; `plans/exercise-practice.md:248`). Cần định rõ route và cách truyền/khôi phục bộ lọc từng link; nếu phải sửa màn đích, đưa file và test trực tiếp vào đường dẫn/phạm vi Task 2, hoặc giới hạn cam kết theo khả năng màn nguồn. Không mặc định query string có hiệu lực.
4. **Bảng lỗi và nghiệm thu chưa khép kín:** hai GET không có body/đối tượng sở hữu, không gọi dịch vụ ngoài, không ghi nên dữ liệu sai, không phải chủ, trùng ghi/callback không áp dụng; cần ghi rõ các trường hợp không áp dụng và quy định query không hỗ trợ (bỏ qua hay từ chối), thay vì suy ra 400. Bảng có 500 và đồng thời nhưng `Xong khi` chưa kiểm lỗi DB/không trả dở dang, hai loại 401, và hành vi đồng thời được chọn (`plans/dashboard-stats.md:53`–`:66`, `:74`–`:78`). Không đòi thử thanh toán/callback thực từ endpoint chỉ đọc; cần dữ liệu fixture tương ứng để kiểm doanh thu, gồm đơn hết hạn chưa PAID, hai giao dịch cùng đơn PAID và hai đơn PAID riêng cho cùng khóa (`plans/course-payment.md:118`–`:119`, `:146`).
5. **Ranh giới tài chính và kiểu số:** test Moderator chỉ không có ba khóa cấp gốc (`plans/dashboard-stats.md:76`) chưa chứng minh không lộ tiền lồng trong DTO; cần kiểm toàn bộ cấu trúc phản hồi, tài khoản chỉ MODERATOR bị chặn API Admin, tài khoản có cả hai role được phép từng endpoint, tài khoản khóa bị chặn cả hai (`plans/dashboard-stats.md:35`, `:60`–`:62`). PostgreSQL `SUM(bigint)` trả numeric, còn JSON number ở frontend có giới hạn số nguyên chính xác; spec hứa tổng 64 bit (`plans/dashboard-stats.md:66`, `:72`) nhưng chưa quy định overflow, kiểu truyền và hiển thị chính xác trên 2^53−1. Chốt giới hạn/biểu diễn thống nhất backend–frontend và test một giá trị vượt ngưỡng nếu vẫn hứa 64 bit.
6. **Thiếu test cho hành vi đã yêu cầu:** Task 2 nêu chỉ request mới nhất thắng (`plans/dashboard-stats.md:96`) nhưng tiêu chí không kiểm hai phản hồi đảo thứ tự; thiếu ca trạng thái tải, thiếu trường con, link đúng bộ lọc, và chuyển ngôn ngữ/lỗi theo bảng (`plans/dashboard-stats.md:116`–`:122`). Gộp vào test trang liên quan, không cần ma trận tích hợp lớn. `ArticleStats` còn dùng ở cả hàng đợi khóa học (`app/src/pages/Moderator/Courses/ModeratorCoursesPage.tsx:25`, `:47`, `:86`), nên giữ nguyên component và không sửa test nơi dùng nếu không sửa component.
7. **Thiếu chỉ dẫn về file test thực tế và lệnh:** `server/src/test/java/com/techverse/server/dashboard/**` (`plans/dashboard-stats.md:19`) cần thống nhất package/lớp tạo, ghi tên file test frontend và lệnh chạy test liên quan cụ thể như template (`plans/_template.md:65`), bên cạnh build. Đường dẫn màn đích/test bổ sung theo mục 3 ở trên.

### Thừa

- “Mỗi chỉ số có một ca test đối chiếu API danh sách” (`plans/dashboard-stats.md:72`) vượt ngân sách và không phải chỉ số nào cũng có API danh sách tương đương; `Xong khi` dòng 77 đã giới hạn vào chỉ số có bộ lọc tương ứng. Gộp fixture kiểm số trực tiếp, chọn vài ca đối chiếu thực sự bắt được sai lệch bộ lọc; giữ khoảng 3–5 luồng tích hợp cho mỗi endpoint, không nhân mọi chỉ số thành test DB riêng. `plans/dashboard-stats.md:77` và ngân sách backend ở `plans/_template.md:65` là căn cứ cho phạm vi kiểm.

### Sáu câu hỏi cần người dùng chốt

Lộ trình dành ngày 26/11 cho dashboard và hạn 28/11 (`plans/PLAN.md:42`–`:44`); ước lượng dưới đây chỉ là mức tương đối, không phải cam kết lịch.

1. **Giữ mặc định** danh sách Admin, sau khi làm rõ định nghĩa và điều kiện sẵn sàng như trên. Đủ việc quản trị thiết yếu; thêm/bớt chỉ số cần sửa API, UI và fixture, từ nhỏ đến đáng kể tùy nguồn.
2. **Giữ mặc định** hai mốc và bốn số; có đối chiếu ngắn hạn lẫn tổng tích lũy, tái dùng snapshot đơn. Đổi/bớt mốc hoặc số là công sức nhỏ đến vừa; thêm kỳ hoặc lọc ngày phát sinh thiết kế và test lớn hơn. Làm rõ số đơn phải hiện trong UI vì phạm vi chỉ liệt kê ba số tiền (`plans/dashboard-stats.md:86`, `:107`, `:129`).
3. **Giữ mặc định** số hàng đợi và báo cáo, không có dữ liệu người dùng/doanh thu; đúng T6 và giúp xử lý việc (`plans/roadmap.questions.md:267`). Bớt ô ít công; thêm người dùng hoặc tài chính cần quyết định lại quyền, công và rủi ro lớn hơn.
4. **Giữ mặc định** không biểu đồ/cache, có tải lại: phù hợp một ngày dự kiến, tránh xử lý invalidation. Thêm biểu đồ hay cache cần thiết kế dữ liệu, cập nhật và kiểm chứng, công đáng kể; bỏ tải lại chỉ tiết kiệm ít và giảm khả năng cập nhật.
5. **Giữ mặc định** không wireframe riêng, dùng primitive sẵn có; hai trang đã có ô/lưới (`app/src/pages/Admin/AdminDashboardPage.tsx:30`–`:34`, `app/src/pages/Moderator/ArticleStats.tsx:43`–`:53`). Nếu đổi sang duyệt wireframe cần thêm bước chuẩn bị và chờ duyệt, công nhỏ đến vừa nhưng có thể ảnh hưởng lịch; vẫn kiểm giao diện như tiêu chí hiện tại.
6. **Giữ mặc định** ẩn ô chưa có nguồn thay vì 0 giả, áp dụng theo từng task nguồn và từng trường như mục Thiếu 2. Nếu đổi sang ô “chưa hỗ trợ”, cần thêm trạng thái/copy vi/en và test, công nhỏ đến vừa; không được biểu diễn chưa có dữ liệu nguồn bằng 0.

### Kết luận: thân spec cần thay đổi

- **Chặn chốt:** thống nhất nghĩa công khai với nguồn; chốt tập đơn chờ xác nhận/đã hết hạn; sửa semantics snapshot; định nghĩa chỉ số và biên thời gian; quy định phụ thuộc từng task và hình dạng phản hồi; làm khả thi link có lọc trong đúng phạm vi; bổ sung nghiệm thu quyền/tài chính, thanh toán trùng và bảng lỗi; thống nhất biểu diễn số lớn.
- **Không chặn nếu được ghi rõ khi hoàn thiện:** cắt kiểm đối chiếu lặp vượt ngân sách; bổ sung test request về sai thứ tự, tải/lỗi và lệnh test/frontend; nói rõ hiển thị số đơn, liệt kê file màn đích thực sự cần sửa.

### Đề xuất ngoài spec (không chặn chốt)

- Sau hạn, cân nhắc tái sử dụng điều kiện truy vấn của module nguồn qua một lớp chung khi có nhu cầu bảo trì: hiện DashboardRepository sao chép điều kiện (`plans/dashboard-stats.md:34`, `:71`) nên có nguy cơ lệch; không yêu cầu sửa repository nguồn trong module này.

## Trả lời vòng 1 (Claude)

Đã đối chiếu các ý trên code và các spec nguồn ngày 2026-11-15; thân spec đã sửa theo các ý Chấp nhận/Một phần.

1. **Các ý Đúng:** không đổi. Ghi nhận thêm: `/api/v1/moderator/dashboard` cần matcher mới, đã ghi dứt khoát vào đường dẫn và kế hoạch.
2. **Sai 1 — Chấp nhận, chọn hướng đơn giản.** `content` đếm theo trạng thái công khai của chính nội dung, không xét tác giả còn hiển thị; ghi rõ số này có thể lớn hơn số người đọc thấy. Bỏ việc so với API công khai; thêm ca tác giả bị đình chỉ vẫn được tính.
3. **Sai 2 — Chấp nhận.** “Đơn chờ xác nhận” = có cờ đã báo chuyển khoản và đang `PENDING` hoặc `EXPIRED`; đơn `PAID`/`FAILED`/`CANCELLED` không tính. Liên kết không còn hứa cùng tập với bộ lọc của trang đơn.
4. **Sai 3 — Chấp nhận.** Bỏ chữ “ảnh chụp”; ghi rõ không hứa nhất quán giữa các số, chỉ lấy một thời điểm tham chiếu cho các mốc ngày.
5. **Thiếu 1 — Chấp nhận.** Định nghĩa từng chỉ số và biên thời gian: `total` mọi role, tác giả đếm theo dòng hồ sơ, bài hỏi diễn đàn là bài gốc `VISIBLE`, `hiddenPosts` gồm cả câu trả lời, `paidOrders` là số đơn phân biệt, tiền cộng từ item và không nối bảng giao dịch.
6. **Thiếu 2 — Chấp nhận.** Thêm bảng phụ thuộc theo từng task nguồn và quy tắc hình dạng JSON (bỏ hẳn khóa, không `null`, không 0; nhóm rỗng thì bỏ nhóm); điều kiện lấy từ code nguồn khi đã có và đối chiếu spec đã chốt.
7. **Thiếu 3 — Chấp nhận, thu hẹp cam kết.** Các trang đích giữ bộ lọc trong state (`AuthorApplicationsPage.tsx:42`–`50`, `ModeratorArticlesPage.tsx:30`–`37`) và mặc định vốn là “chờ duyệt”, nên liên kết chỉ dẫn tới route, không hứa lọc sẵn và không sửa trang đích.
8. **Thiếu 4 — Chấp nhận.** Ghi rõ các nhóm ngoại lệ không áp dụng, tham số lạ bị bỏ qua; thêm `DashboardServiceTest` cho lỗi DB/không trả dở dang, hai loại 401 ở `@WebMvcTest`, và bộ dữ liệu doanh thu gồm đơn hết hạn, hai giao dịch một đơn, hai đơn một khóa.
9. **Thiếu 5 — Chấp nhận.** Test Moderator kiểm toàn bộ cấu trúc JSON chứ không chỉ ba khóa gốc; thêm ca tài khoản hai vai. Bỏ lời hứa 64 bit: giới hạn tiền là 2^53 − 1, vượt thì trả lỗi thay vì số sai.
10. **Thiếu 6, 7 — Chấp nhận.** Thêm ca phản hồi về sai thứ tự, trạng thái tải, thiếu trường con, đổi ngôn ngữ; ghi tên file test backend và frontend; không sửa `ArticleStats`.
11. **Thừa — Chấp nhận.** Chỉ còn hai ca đối chiếu với API hàng đợi (bài viết, khóa học); các chỉ số khác kiểm bằng dữ liệu mẫu.
12. **Sáu câu hỏi mở:** Codex khuyến nghị giữ mặc định cả sáu; Claude đồng ý. Theo lưu ý ở câu 2, giao diện doanh thu nay hiện cả số đơn đã thanh toán.
13. **Đề xuất ngoài spec (lớp điều kiện truy vấn dùng chung):** để sau hạn, không đưa vào spec.

**Điểm yếu còn lại:** câu đếm chép lại điều kiện của module nguồn nên có thể lệch khi module nguồn đổi, chỉ có hai ca đối chiếu canh; phần lớn chỉ số phụ thuộc module chưa code nên API thật có thể ít trường hơn spec; số “nội dung đang công khai” không trừ nội dung của tác giả bị đình chỉ.

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)
