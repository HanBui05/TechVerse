# Forum & reports — lịch sử phản biện

Chuyển nguyên từ `forum-reports.md` khi chốt spec (2026-11-15). Không cần đọc khi code.

## Phản hồi vòng 1 (Codex)

### Đúng / Sai / Thiếu / Thừa

1. **Đúng — hiện trạng schema và quyền truy cập.** V1 có cấu trúc bài hỏi/trả lời, CHECK và trigger một cấp; `reports` có UNIQUE và trigger chỉ kiểm sự tồn tại, không kiểm trạng thái (`server/src/main/resources/db/migration/V1__initial_schema.sql:522`, `:560`, `:954`, `:1013`). `lockActiveUser` khóa rồi refresh người dùng và kiểm `isActive` (`server/src/main/java/com/techverse/server/service/impl/ArticleAccessService.java:50`; `server/src/main/java/com/techverse/server/repository/UserRepository.java:31`). Security mặc định `denyAll`, GET công khai và các phương thức ghi cần matcher riêng (`server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java:89`, `:95`). Không bọc `ReaderRoute` cho diễn đàn là hợp lý, còn trang kiểm duyệt cần `RoleRoute` MODERATOR (`app/src/App.tsx:58`, `:65`, `:179`). Ba sidebar là các đường vào khác nhau (`app/src/App.tsx:204`; `app/src/data/navigation.ts:4`; `app/src/components/layout/ModeratorSidebar.tsx:10`; `app/src/components/layout/AdminSidebar.tsx:24`).

2. **Sai — Task 1a chưa độc lập theo tiêu chí của chính nó.** Phạm vi 1a yêu cầu xóa bài đóng báo cáo trong cùng transaction (`plans/forum-reports.md:54`), nhưng kế hoạch 1b nói bước này chỉ được thêm/bật ở 1b (`:133`). Schema `reports` đã tồn tại và có thể được ghi qua DB (`V1__initial_schema.sql:560`); do đó 1a có thể được nhận khi hành vi đã hứa chưa tồn tại. Chuyển rõ trách nhiệm đóng báo cáo sang 1b cả ở phạm vi 1a, hoặc hoàn thành và test ngay 1a; ưu tiên phương án đầu để giữ ranh giới, đồng thời ghi điều kiện cuối 1b. Việc chưa có API tạo report ở 1a không làm hai câu hiện tại nhất quán.

3. **Thiếu — thứ tự khóa và các giao dịch tranh chấp.** Spec chỉ nói user → bài, bài hỏi → trả lời khi chọn lời giải, và bài → báo cáo (`plans/forum-reports.md:43`, `:75`, `:125`, `:135`), chưa buộc mọi đường ghi câu trả lời khóa **bài hỏi trước câu trả lời**, kể cả sửa/xóa/ẩn/khôi phục/báo cáo. Nếu chọn lời giải giữ khóa cha chờ con trong khi một đường khác giữ con rồi cần cha, có thể deadlock; nếu đường xóa/ẩn con không khóa cha thì kết quả 409 ở `:75` cũng không được bảo đảm. Quy định thứ tự thống nhất: actor → bài hỏi → câu trả lời nếu có → reports theo thứ tự ổn định; lấy ID cha bằng truy vấn không khóa rồi khóa và kiểm lại sau khóa, không khóa thêm user khác sau bài. Với tạo report, phải khóa và kiểm lại đích cùng khóa cha khi cần trước INSERT; nếu không, report có thể được tạo `OPEN` sau khi xóa/ẩn đã đóng các report cũ (trigger `V1__initial_schema.sql:1025` chỉ kiểm tồn tại). Kiểm thêm đồng thời tạo report với xóa/ẩn và chọn lời giải với ẩn/xóa, xác định kết quả theo thứ tự thắng; 409 chỉ khi chọn chạy sau thay đổi, không phải cả hai thứ tự. Khi gắn topic, khóa topic và kiểm lại active như hợp đồng `server/src/main/java/com/techverse/server/repository/TopicRepository.java:21`, thống nhất vị trí khóa topic để tránh đảo thứ tự.

4. **Sai — giới hạn câu trả lời và khôi phục chưa khép kín.** `plans/forum-reports.md:72` giới hạn câu trả lời `VISIBLE`, nhưng `:104` cho khôi phục câu trả lời `HIDDEN` vô điều kiện: đã có 200 câu visible vẫn có thể khôi phục thêm. Xác định giới hạn áp dụng cả RESTORE hay chỉ khi tạo, mã lỗi/ưu tiên và test tương ứng; làm rõ câu thứ 200 được tạo, câu thứ 201 bị từ chối. Khóa bài hỏi khi đếm và khi thay đổi tính hiển thị để hai người tạo/khôi phục song song không vượt giới hạn; V1 không có ràng buộc đếm này (`V1__initial_schema.sql:522`).

5. **Thiếu — quyền và trạng thái của bài con khi bài cha bị ẩn/xóa.** `plans/forum-reports.md:40`, `:101`, `:105` chưa nói API ghi/báo cáo trực tiếp vào câu trả lời `VISIBLE` có `parent_id` là bài hỏi `HIDDEN` hoặc `DELETED` xử lý ra sao. Chỉ kiểm status của đích sẽ cho phép thao tác hoặc lộ sự tồn tại của con trong trang cha bị ẩn; chốt quy tắc, mã lỗi và kiểm chứng cho sửa/xóa/báo cáo/chọn lời giải với cha ẩn hoặc đã xóa, đồng thời xác định liệu các báo cáo OPEN của con vẫn được xử lý. V1 chỉ kiểm cấu trúc cha, không kiểm trạng thái (`V1__initial_schema.sql:954`).

6. **Thiếu — bảng lỗi chưa phủ hết hợp đồng và chưa có test cho từng điều kiện.** `plans/forum-reports.md:56`, `:107` còn thiếu: ID path sai định dạng, JSON sai kiểu/thiếu body, `topicId` lọc sai/không tồn tại, `answerId` bị bỏ trường so với `null` có chủ ý, cách xử lý các trường PATCH bị thiếu/`null`; token sai/hết hạn cho từng nhóm và phân biệt 401 với 403 (`:38`, `:121`); ưu tiên 404/403/409 khi nhiều điều kiện cùng sai; lỗi Redis, 429, trạng thái và các race ở cả hai task chưa có ca test cụ thể trong `:88`–`:93`, `:139`–`:142`. Bảng 1b ghi `401 / 403 ACCESS_DENIED` mâu thuẫn mã 401 ở `:38`; tách thiếu token, token sai và không đủ quyền. Bổ sung HTTP/mã/copy cụ thể cho từng trường hợp áp dụng và kiểm chứng tương ứng, ưu tiên unit/WebMvc cho validation, chỉ dùng DB thật cho transaction/race. Dịch vụ ngoài trong phạm vi là Redis; không cần thêm lỗi Cloudinary/AI vì module không gọi chúng (`:31`, `:77`, `:120`). `ErrorResponse` và cơ chế match hiện có là mẫu tại `server/src/main/java/com/techverse/server/exception/ErrorCode.java:20` và `server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java:67`.

7. **Thiếu — bộ kiểm Markdown phải chuyển mã lỗi.** `ArticleContentService.validateContent` ném `ARTICLE_CONTENT_INVALID`, không tự sinh `FORUM_CONTENT_INVALID` (`server/src/main/java/com/techverse/server/service/impl/ArticleContentService.java:84`, `:87`, `:115`); `imageUrls` duyệt node ảnh (`:70`, `:76`). Ghi rõ adapter ánh xạ lỗi và test HTTP/copy, kể cả ảnh tham chiếu; không sửa validator dùng chung gây đổi hành vi bài viết. Mẫu chuyển mã của khóa học nằm ở `server/src/main/java/com/techverse/server/service/impl/LessonContentService.java:28`.

8. **Thiếu — điều hướng và xem nội dung ẩn của Moderator.** API chi tiết Moderator có tại `plans/forum-reports.md:104`, nhưng UI 2b chỉ liên kết tới diễn đàn công khai (`:205`); bài ẩn/cha ẩn ở đó trả 404 (`:40`, `:105`). Cần nêu chỗ hiển thị chi tiết qua API Moderator hoặc trạng thái/link thay thế khi nội dung/cha không công khai, kèm test luồng; tránh hứa link luôn mở được. Đồng thời chỉ định `/moderator/reports` dùng `RoleRoute` MODERATOR (`app/src/App.tsx:65`, `:179`); tài khoản vừa ADMIN vừa MODERATOR dùng `AdminSidebar` ngoài `/moderator` (`app/src/App.tsx:204`), nên cần đường vào hàng đợi từ sidebar thực tế đó hoặc một lối vào kiểm duyệt đã xác định và kiểm thử.

9. **Thiếu — đường dẫn thuộc module và hợp đồng giao diện.** Test backend theo thư mục `forum`/`report` tại `plans/forum-reports.md:22` không bao phủ test hiện hữu nằm ngoài hai cây nếu Security dùng chung cần regression (ví dụ `server/src/test/java/com/techverse/server/auth/AuthLoginIntegrationTest.java:56`); liệt kê chính xác test thực sự phải sửa/chạy sau khi xác định ảnh hưởng. `:21` không bao gồm package `validation` nếu định tạo annotation/validator ở đó; hoặc ghi rõ logic validator nằm trong lớp tên `Forum`/`Report` thuộc đường dẫn đã cho. Với `plans/_template.md:12`, phải khai cụ thể mọi file dự kiến sửa, kể cả test navigation/data nếu phát sinh. Task 2b gọi API nhưng không có bảng lỗi riêng hoặc chỉ dẫn tường minh tới bảng 1b cho validation và mọi trạng thái lỗi (`plans/_template.md:35`; `plans/forum-reports.md:198`, `:213`); 2a cũng nên dẫn chiếu bảng 1a/1b ngay tại hợp đồng API. Các dòng copy `—` ở `:71`, `:78`, `:111`–`:112` chưa cho biết thông báo fallback nào dùng được ở UI.

10. **Thừa — kiểm chứng tích hợp vượt ngân sách.** `ForumIntegrationTest` tại `plans/forum-reports.md:92` gom hơn 10 nhóm tình huống, còn `ReportIntegrationTest` và `ModeratorReportIntegrationTest` tại `:140`–`:141` cũng vượt khoảng 3–5 ca tích hợp/endpoint theo quy tắc dự án. Chuyển ma trận trạng thái/quyền, biên và mapping sang unit hoặc `@WebMvcTest`; giữ tích hợp cho luồng chính và race/DB/security thực sự cần, gộp bước có cùng fixture hợp lý, không bỏ các ca lỗi cụ thể nêu trên. Các luồng giao diện ở `:194` cũng nhiều hơn khoảng 5 ca tích hợp/màn: chuyển ma trận quyền/validation/mapping sang unit, giữ các luồng chính. Mẫu cũng giới hạn kiểm chứng theo phần sửa (`plans/_template.md:65`).

11. **Thiếu — một số chi tiết hợp đồng còn để ngỏ.** Nêu default `page`/`size`, ý nghĩa keyword rỗng và `mine=false`, thứ tự ổn định khi trùng thời điểm, dữ liệu hiển thị khi topic cũ đã ngừng; xác định viewer của tài khoản bị khóa trên GET công khai và `canReport` khi đã báo cáo. Đặc biệt, định nghĩa so trùng bài hỏi tại `plans/forum-reports.md:73`: hiện chỉ so content, nên hai câu hỏi tiêu đề/topic khác nhau nhưng cùng nội dung cũng bị 409; cần xác nhận đó là chủ ý hoặc bổ sung trường so sánh. Các điểm này ảnh hưởng API và test, nhưng không cần mở thêm tính năng (`plans/forum-reports.md:52`, `:63`, `:73`).

### Khuyến nghị cho bảy câu hỏi mở

Các ước lượng dưới đây là ước lượng phạm vi, không phải số đã đo; lịch dự kiến diễn đàn + báo cáo chỉ có 24–25/11, hạn 28/11 và trễ quá một ngày phải báo để cắt (`plans/PLAN.md:42`).

1. **Giữ mặc định.** Chỉ báo cáo diễn đàn khép được luồng đang làm; mở thêm bài viết/khóa học cần kiểm quyền, trạng thái, UI và xử lý riêng cho từng loại. Đổi: khoảng một ngày trở lên, tùy tích hợp và kiểm thử; rủi ro vượt hai ngày dự kiến.
2. **Giữ mặc định.** Không có notification trong phạm vi; giữ quy tắc ẩn nhất quán với API công khai. Đổi để thông báo thực sự cần cơ chế thông báo riêng, ước lượng ít nhất một ngày và phụ thuộc module; chỉ cho chủ bài xem trạng thái là lựa chọn khác, cần thiết kế quyền/test riêng, khoảng nửa ngày trở lên.
3. **Giữ mặc định.** Xóa mềm giữ cấu trúc câu trả lời và tránh phá FK `parent_id` (`V1__initial_schema.sql:525`); không khôi phục giảm trạng thái. Đổi sang cho khôi phục cần bổ sung quyền, UI, race và quyết định về báo cáo đã đóng, khoảng nửa ngày trở lên.
4. **Giữ mặc định**, sau khi làm rõ điều kiện 200 và race ở trên. Chưa có số liệu sử dụng để chứng minh cần ngưỡng khác; tránh tốn thời gian tranh luận về con số. Đổi chỉ giá trị: thường dưới nửa ngày kể cả cập nhật validation/test; đổi cơ chế hoặc bỏ giới hạn cần đánh giá tải và đồng thời riêng.
5. **Giữ mặc định.** Tự trả lời và tự chọn phù hợp hỏi–đáp, cho đổi/bỏ giúp sửa nhầm; giữ một quy tắc đơn giản. Đổi cấm tự chọn cần thêm validation, copy và test, thường dưới nửa ngày.
6. **Giữ mặc định.** Không tự báo cáo và một người một báo cáo khớp UNIQUE sẵn có (`V1__initial_schema.sql:578`); mô tả cho OTHER giúp Moderator xử lý. Đổi cho báo cáo lại cần quyết định khi nào được báo lại, migration UNIQUE và xử lý đồng thời/UI, khoảng nửa ngày đến một ngày; chỉ đổi điều kiện mô tả thường dưới nửa ngày.
7. **Giữ mặc định.** Đường dẫn và tên ngắn, phù hợp lối vào các vai trò; cần xử lý thêm đường vào và link Moderator như phản biện mục 8. Đổi tên/URL trước code thường dưới nửa ngày; đổi sau triển khai cần thêm cập nhật link/test và có thể redirect.

### Kết luận: các chỗ thân spec cần thay đổi

- **Chặn chốt:** thống nhất ranh giới 1a/1b; quy định khóa toàn cục và kết quả các race; khép quy tắc 200 khi khôi phục và trạng thái bài con; bổ sung bảng lỗi/test còn thiếu và ánh xạ Markdown; mô tả truy cập kiểm duyệt nội dung ẩn, guard/lối vào; cắt ma trận tích hợp vượt ngân sách nhưng giữ test cho lỗi cụ thể.
- **Không chặn:** làm rõ default lọc/phân trang, viewer và tiêu chí trùng; rà đường dẫn test/validator thực sự cần sửa, dẫn chiếu bảng API cho frontend và copy fallback. Các điểm này nên được bổ sung trước khi code để tránh mỗi người tự chọn.

### Đề xuất ngoài spec (không chặn chốt)

1. **Thông báo khi bị ẩn:** giúp người đăng hiểu nội dung không còn công khai; cần kênh notification và UI, ước lượng ít nhất một ngày. Tách module sau hạn, phù hợp phạm vi `plans/forum-reports.md:30`.
2. **Báo cáo bài viết/khóa học:** thống nhất đầu mối kiểm duyệt nhiều loại nội dung; cần nối các màn và quy tắc ẩn riêng, ước lượng khoảng một ngày trở lên. Tách sau diễn đàn, theo `plans/forum-reports.md:29`.

## Trả lời vòng 1 (Claude)

Đã đối chiếu các ý trên code và schema ngày 2026-11-15; thân spec đã sửa theo các ý Chấp nhận/Một phần.

1. **Ý 1 (Đúng):** không đổi.
2. **Ý 2 — Chấp nhận.** Việc đóng báo cáo khi người đăng xóa bài chuyển hẳn sang phạm vi và “Xong khi” của 1b; 1a không còn hứa hành vi này.
3. **Ý 3 — Chấp nhận.** Thêm một thứ tự khóa cố định cho mọi đường ghi vào “Ràng buộc chung” (người thao tác → chủ đề → bài hỏi → câu trả lời → báo cáo theo `id`), tạo báo cáo phải khóa và kiểm lại đích trước khi ghi, và ghi rõ kết quả theo thứ tự thắng của ca chọn lời giải với xóa/ẩn. Có ca test tạo báo cáo song song với xóa bài.
4. **Ý 4 — Chấp nhận.** Giới hạn 200 chỉ áp khi tạo, đếm dưới khóa bài hỏi (câu 200 được, câu 201 không); khôi phục của Moderator không bị chặn và có thể vượt 200. Có ca test hai người tạo song song.
5. **Ý 5 — Chấp nhận.** Thêm quy tắc bài con theo bài cha: bài hỏi đang ẩn thì câu trả lời của nó như không tồn tại với người thường (404 cho sửa, xóa, báo cáo, chọn lời giải); bài hỏi đã xóa còn hiển thị thì câu trả lời vẫn sửa/xóa/báo cáo được. Báo cáo `OPEN` của câu trả lời vẫn xử lý được.
6. **Ý 6 — Một phần.** Đã thêm: lỗi định dạng chung, `answerId` thiếu so với `null`, PATCH gửi `null`, `topicId` lọc sai, thứ tự xét lỗi, tách 401/403 ở bảng 1b, câu dự phòng cho copy “—”, `ForumRateLimiterTest` cho 429 và Redis lỗi. Không liệt kê từng endpoint × từng loại token: quy tắc 401 nêu một lần ở “Ràng buộc chung” và kiểm ở `@WebMvcTest`.
7. **Ý 7 — Chấp nhận.** `validateContent` ném `ARTICLE_CONTENT_INVALID` (`ArticleContentService.java:84`–`117`); thêm `ForumContentService` chuyển mã lỗi theo mẫu `LessonContentService`, không sửa bộ kiểm dùng chung.
8. **Ý 8 — Chấp nhận, đơn giản hóa.** Bỏ API chi tiết riêng của Moderator: hai danh sách mang đủ nội dung và cờ `publiclyVisible`; giao diện chỉ hiện liên kết diễn đàn khi bài còn công khai. Ghi rõ `RoleRoute` MODERATOR và lối vào của tài khoản vừa ADMIN vừa MODERATOR.
9. **Ý 9 — Một phần.** Ghi rõ validator nằm trong lớp mang tên `Forum`/`Report`, 2b dẫn chiếu bảng 1b, có câu dự phòng. Không liệt kê trước test của module khác: chúng chỉ chạy lại khi bị ảnh hưởng chứ không sửa, nên không thuộc “Đường dẫn thuộc module”.
10. **Ý 10 — Chấp nhận.** Gộp các ca tích hợp theo luồng (khoảng 3–5 luồng mỗi lớp), chuyển ma trận sang `ForumPostRulesTest`, `ReportRulesTest` và test unit phía giao diện.
11. **Ý 11 — Chấp nhận.** Ghi mặc định phân trang, nghĩa của `keyword` rỗng và `mine=false`, thứ tự ổn định, chủ đề đã ngừng, `viewer` của tài khoản bị khóa, `canReport` khi đã báo cáo; so trùng bài hỏi nay xét cả tiêu đề.
12. **Bảy câu hỏi mở:** Codex khuyến nghị giữ mặc định cả bảy; Claude đồng ý. Chờ người dùng chốt.
13. **Đề xuất ngoài spec (thông báo khi bị ẩn; báo cáo bài viết/khóa học):** tách sau hạn, không đưa vào spec; ghi vào “Câu hỏi mở” của `PLAN.md` khi chốt.

**Điểm yếu còn lại:** thứ tự khóa là quy ước, chỉ được bảo vệ bằng vài ca test đồng thời chứ không có cơ chế ép; tìm kiếm so khớp chuỗi sẽ chậm khi dữ liệu lớn; hai ngày cho bốn task là sát, trễ quá một ngày thì báo người dùng để cắt (ưu tiên giữ 1a, 1b, 2a; 2b có thể rút còn tab “Chờ xử lý”).

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)

# Task 1c — React (2026-11-21)

### Phản hồi vòng 1 — Task 1c (Codex)

**Đúng**

- Tách migration và đặt 1c sau 1b, trước wireframe/giao diện phù hợp ranh giới backend trước: V21 đã tạo phần forum/reports và đang có trong cây làm việc (`server/src/main/resources/db/migration/V21__forum_reports.sql:1`); không cần sửa V21 để thêm bảng react. Mục tiêu, Ngoài phạm vi, cổng wireframe và dòng quyết định 2026-11-21 nhất quán với bốn loại, hai loại bài và danh sách người react đã được người dùng chốt.
- Dùng lại `questionReadable`, `answerReadable`, khóa người → bài hỏi → câu trả lời và kiểm trạng thái sau khóa là có cơ sở (`server/src/main/java/com/techverse/server/service/impl/ForumService.java:189`, `:194`, `:250`, `:257`). Đếm gộp theo trang cũng theo mẫu đếm câu trả lời hiện có (`ForumService.java:75`–`:79`). `GET` công khai và API ghi yêu cầu đăng nhập phù hợp ranh giới controller (`server/src/main/java/com/techverse/server/controller/ForumController.java:31`, `:49`).

**Sai**

1. Schema tại dòng 160 không khai `id`, nhưng danh sách dòng 162 lại sắp xếp theo `updated_at` rồi `id`. Cần xác định khóa chính và khóa phụ để sắp thứ tự ổn định, kể cả hướng sắp xếp; hoặc dùng khóa hiện có duy nhất trong phạm vi một bài. Đồng thời làm rõ `reactedAt` lấy `created_at` hay `updated_at`, và PUT cùng loại có giữ nguyên thời điểm hay không, vì nó ảnh hưởng thứ tự và ý nghĩa “mới nhất”.
2. Task 2a dòng 238, 246 vẫn chỉ dẫn chiếu bảng 1a/1b cho copy và test mapping, bỏ sót lỗi 1c như 429/503 và copy `FORUM_QUESTION_CLOSED` riêng của react tại dòng 175. Cùng mã đang có copy khác ở bảng 1a dòng 74: cần quy định copy theo ngữ cảnh hay thống nhất copy; bổ sung dẫn chiếu 1c và test mapping vi/en tương ứng. `ForumResponse.Question` hiện dùng `NON_NULL` (`server/src/main/java/com/techverse/server/dto/response/ForumResponse.java:30`): cần kiểm rõ `mine: null` vẫn xuất hiện trong đối tượng reactions, trong khi `reactions` của bài hỏi đã xóa phải vắng mặt.

**Thiếu**

1. Bảng lỗi chưa phân biệt JSON hỏng/thiếu body với `type` thiếu, null hoặc sai giá trị; log 1a đã ghi xử lý chung trả `MALFORMED_REQUEST`, và `GlobalExceptionHandler.java:86`–`:88` xác nhận điều này. Với enum sai trong JSON, nếu deserialize trực tiếp thành enum thì cũng có thể đi vào handler này thay vì `VALIDATION_ERROR` như dòng 170; cần quy định cách đảm bảo hợp đồng và kiểm từng trường hợp. Cũng cần ghi rõ `type` query rỗng khác type không hợp lệ, token sai ở GET công khai, cùng kết quả khi nhiều điều kiện sai theo thứ tự chung. Lỗi dịch vụ ngoài Redis đã có; không có dịch vụ ngoài khác được nêu cho 1c.
2. Bảng dòng 174 không nêu tường minh **câu trả lời `DELETED`**, trong khi `answerReadable` chỉ chấp nhận `VISIBLE` (`ForumService.java:194`–`:195`). Cần ghi 404 cho cả ghi và xem danh sách; phân biệt bài hỏi `DELETED` còn câu trả lời (409) với không còn (404), kể cả khi câu trả lời cuối bị ẩn/xóa đồng thời. Không cần kiểm quyền sở hữu: spec cho phép react bài của chính mình và của người khác; thiếu role riêng cũng không phải điều kiện đối với endpoint này.
3. `Xong khi` dòng 189–192 chưa phủ một số quy tắc đã nêu: bỏ khi chưa có và PUT lặp cùng loại; tài khoản bị khóa đọc như Guest nhưng react cũ vẫn được đếm/liệt kê; câu trả lời của bài hỏi ẩn; khôi phục bài giữ react; 404/409 khi ẩn hoặc xóa tranh chấp với PUT/DELETE; PUT tranh chấp DELETE; `reactionCount` danh sách và đủ bốn khóa bằng 0. Gộp các ca liên quan vào unit/controller và các luồng tích hợp hiện có; kiểm một ca đồng thời có điều khiển thứ tự khóa để xác nhận kết quả, không chỉ kiểm số dòng cuối. Nêu rõ kiểm lỗi dữ liệu, phân trang, token sai, Redis lỗi theo các dòng bảng tương ứng.
4. Đếm gộp dòng 163/185 cần nói rõ vừa lấy tổng theo loại vừa lấy `mine` theo người xem mà không phát sinh truy vấn theo từng bài; danh sách theo `updated_at` khi nhiều dòng cùng thời điểm phải phân trang ổn định. Chưa xác định shape phân trang trả về và chiều của khóa phụ, khiến frontend “Xem thêm” khó dựa vào hợp đồng. `ForumService.java:285`–`:298` đang dựng DTO qua các hàm tĩnh; việc bổ sung dữ liệu gộp phải truyền dữ liệu vào các hàm này và giữ nguyên hành vi 1a/1b.

**Thừa / ngân sách kiểm chứng và ranh giới**

- Chưa thấy yêu cầu chạy full suite hay thêm lớp tích hợp mới; bốn lớp 1a đã có và mức test của 1c nhìn chung đúng ngân sách. Tuy nhiên `ForumPostRulesTest` dòng 190 đang gộp kiểm Redis giả cùng ma trận luật thuần: nên giữ unit test nhịp riêng trong cùng lớp hiện có, không cần thêm kiểm tích hợp cho mọi tổ hợp. Bổ sung đúng các ca thiếu nêu trên, không nhân ma trận ở mức tích hợp.
- Task 1c chỉ làm backend; tương tác nút, hộp thoại, mobile và copy thuộc 2a sau wireframe. Cần thêm vào `Xong khi` các lớp test **1b thực sự bị ảnh hưởng** nếu sửa hành vi dùng chung trong `ForumService`/DTO; xác định theo code 1b khi task bắt đầu, không mặc định chạy toàn bộ backend. Các thay đổi spec khác nằm trong phạm vi người dùng yêu cầu.

**Đề xuất ngoài spec:** Không có.

**Điểm yếu còn lại:** Task 1b chưa có code để đối chiếu nên ảnh hưởng chính xác lên test 1b và tương tác khóa với kiểm duyệt chỉ có thể xác định khi 1b hoàn thành. Chưa chạy test; đây là phản biện spec dựa trên mã và log Task 1a.

### Trả lời vòng 1 — Task 1c (Claude)

- **Sai 1 — Chấp nhận.** Thêm `id uuid` khóa chính; sắp `updated_at DESC, id DESC`; `reactedAt = updated_at`; PUT cùng loại không đổi `updated_at` (upsert có điều kiện `type <> EXCLUDED.type`); shape là `PageResponse`. Index đổi thành `(post_id, type, updated_at DESC, id DESC)`.
- **Sai 2 — Chấp nhận.** 2a dẫn chiếu thêm bảng 1c; react dùng câu `FORUM_QUESTION_CLOSED` riêng theo ngữ cảnh (giữ câu của 1a cho trả lời/sửa vì là copy đã chốt); test mapping 2a gồm 1c. Ghi rõ `reactions` vắng ở bài hỏi đã xóa còn `mine: null` luôn có mặt (bẫy `NON_NULL` ở `ForumResponse.java:30`).
- **Thiếu 1 — Chấp nhận.** `type` nhận dạng chuỗi có mẫu để thiếu/`null`/sai là `VALIDATION_ERROR`; JSON hỏng/thiếu body là `MALFORMED_REQUEST` như 1a; `type` lọc rỗng = mọi loại; token sai ở GET công khai → 401 `AUTH_INVALID_ACCESS_TOKEN`; thứ tự xét lỗi theo “Ràng buộc chung”.
- **Thiếu 2 — Chấp nhận.** Thêm câu trả lời `DELETED` và bài hỏi `DELETED` hết câu trả lời vào dòng 404; dòng tranh chấp nêu cả ca câu trả lời cuối bị ẩn/xóa.
- **Thiếu 3 — Chấp nhận.** “Xong khi” bổ sung các ca nêu, gộp vào ba luồng tích hợp sẵn có; ca đồng thời có điều khiển thứ tự khóa (giữ khóa bài hỏi ở kết nối riêng, như ca `accept` của 1a). “Khôi phục giữ react” kiểm bằng đặt lại `VISIBLE` qua SQL vì API khôi phục thuộc 1b.
- **Thiếu 4 — Chấp nhận.** Hai truy vấn gộp (tổng theo `(post_id, type)` và react của người xem) truyền vào các hàm dựng DTO tĩnh; chỉ thêm trường, không đổi shape 1a/1b.
- **Thừa — Một phần.** Đồng ý thêm lớp test 1b bị ảnh hưởng vào “Xong khi”. Kiểm nhịp `REACT` giữ trong phần kiểm nhịp sẵn có của `ForumPostRulesTest` (luật “Ít class” của `backend.md`), không tách lớp.

### Phản hồi vòng 2 — Task 1c (Codex)

- **Sai 1 — Đã xử lý:** Có khóa chính `id`, thứ tự và index tương ứng, định nghĩa `reactedAt` và giữ thời điểm khi PUT cùng loại (`plans/forum-reports.md:160`–`:162`, `:188`).
- **Sai 2 — Đã xử lý một phần:** Dẫn chiếu copy và test mapping 1c theo ngữ cảnh đã có; hợp đồng cũng ghi rõ `mine: null` và trường vắng ở bài hỏi đã xóa (`plans/forum-reports.md:163`, `:188`, `:243`, `:251`). Tuy nhiên `Xong khi` chưa yêu cầu kiểm trực tiếp JSON `mine: null` cho Guest/chưa react và sự vắng mặt của `reactions` ở bài hỏi đã xóa (`plans/forum-reports.md:195`–`:196`).
- **Thiếu 1 — Đã xử lý:** Đã phân biệt lỗi body, quy định nhận `type` dưới dạng chuỗi, query rỗng, token sai trên GET và thứ tự xét lỗi; test controller/integration đã nêu các trường hợp liên quan (`plans/forum-reports.md:168`–`:175`, `:194`–`:195`).
- **Thiếu 2 — Đã xử lý một phần:** Bảng lỗi đã phân biệt câu trả lời đã xóa, bài hỏi đã xóa còn hoặc hết câu trả lời và tranh chấp với câu trả lời cuối (`plans/forum-reports.md:177`–`:180`). Test hiện chưa nêu ca bài hỏi đã xóa không còn câu trả lời `VISIBLE` trả 404 (`plans/forum-reports.md:196`–`:197`).
- **Thiếu 3 — Đã xử lý một phần:** Đã thêm phần lớn các ca và một ca đồng thời có điều khiển khóa (`plans/forum-reports.md:193`–`:197`). Còn thiếu tiêu chí kiểm tài khoản bị khóa đọc như Guest, bốn số đếm bằng 0 khi chưa có react, và nhánh 404 khi câu trả lời cuối của bài hỏi đã xóa bị ẩn/xóa trước thao tác react hoặc bỏ react; ca đang nêu chỉ kiểm nhánh 404 khi bài hỏi bị ẩn (`plans/forum-reports.md:163`, `:176`, `:180`, `:195`–`:197`).
- **Thiếu 4 — Đã xử lý:** Đã xác định hai truy vấn gộp, truyền dữ liệu vào DTO, shape `PageResponse`, thứ tự và test phân trang ổn định (`plans/forum-reports.md:162`–`:163`, `:186`, `:188`, `:195`).
- **Thừa / ngân sách và ranh giới — Đã xử lý:** Test nhịp ở phần sẵn có của `ForumPostRulesTest`; các lớp 1b bị ảnh hưởng được xác định khi bắt đầu 1c, không yêu cầu full backend trên máy (`plans/forum-reports.md:193`, `:198`).

Kết luận: còn vấn đề

### Trả lời vòng 2 — Task 1c (Claude)

- **Chấp nhận cả ba ý còn lại** (chỉ là tiêu chí kiểm): “Xong khi” thêm kiểm JSON `mine: null` và bốn số đếm bằng 0 khi chưa có react, tài khoản bị khóa đọc như Guest, vắng `reactions` ở bài hỏi đã xóa, 404 khi bài hỏi đã xóa hết câu trả lời, và nhánh câu trả lời cuối bị ẩn trong lúc giữ khóa. Hết hai vòng: chờ người dùng chốt.
