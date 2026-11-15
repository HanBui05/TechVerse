# Messaging — lịch sử phản biện

Chuyển nguyên từ `messaging.md` khi chốt spec (2026-11-15). Không cần đọc khi code.

## Phản hồi vòng 1 (Codex)

### Đối chiếu Đúng / Sai / Thiếu / Thừa

1. **Đúng — cơ sở dữ liệu và quyền học.** `course_enrollments` có `user_id`, `course_id`, `revoked_at` và unique từng cặp còn hiệu lực; `reports` có unique người báo cáo/loại/đích, CHECK loại đích và trigger kiểm sự tồn tại nhưng chưa có nhánh `CONVERSATION` (`server/src/main/resources/db/migration/V1__initial_schema.sql:356`, `:380`, `:560`, `:575`, `:1013`). Cần giữ các nhánh cũ khi thay hàm. Đây là bằng chứng cho hướng migration, không chứng minh API báo cáo đã tồn tại.

2. **Sai — DTO công khai được viện dẫn.** `CourseResponse.authorId` là DTO khác (`server/src/main/java/com/techverse/server/dto/response/CourseResponse.java:13`); endpoint chi tiết công khai dùng `PublishedCourseDetailResponse` với `author`, `viewer.enrolled` (`server/src/main/java/com/techverse/server/controller/PublishedCourseController.java:47`, `server/src/main/java/com/techverse/server/dto/response/PublishedCourseDetailResponse.java:16`, `:25`, `:32`). Trang hiện đọc `course.viewer.enrolled` (`app/src/pages/Courses/CourseOverviewPage.tsx:35`, `:58`); kiểu frontend có `author.id` (`app/src/types/courses.ts:43`, `:46`, `app/src/types/articles.ts:49`). Sửa nhận định hiện trạng và chỉ rõ nguồn danh tính để ẩn nút của chính tác giả; không cần kết luận phải thêm `authorId` vào API.

3. **Đúng có điều kiện — xác thực và khóa.** `lockActiveUser` khóa người thao tác và chỉ kiểm tài khoản active, không đòi tác giả được duyệt (`server/src/main/java/com/techverse/server/service/impl/ArticleAccessService.java:50`, `server/src/main/java/com/techverse/server/repository/UserRepository.java:35`), phù hợp tác giả bị đình chỉ. `SecurityConfiguration` hiện `denyAll` cho đường chưa khai báo (`server/src/main/java/com/techverse/server/configuration/SecurityConfiguration.java:78`, `:95`); khai báo authenticated vẫn phải kiểm role và đối tượng ở service. `AuthRoute`/`ReaderRoute` hiện có và `/messages` đang bị test coi là đường chết (`app/src/App.tsx:50`, `:58`, `app/src/components/layout/Sidebar.test.tsx:50`).

4. **Sai — xung đột mã quyền.** Một mặt người thứ ba kể cả ADMIN nhận 404, mặt khác mọi ADMIN/MODERATOR ở API người dùng nhận 403 (`plans/messaging.md:41`, `:42`, `:71`); test lại cho “404 hoặc 403” (`:102`), không kiểm được hợp đồng. Chốt rõ: người thường không tham gia 404; ADMIN/MODERATOR gọi API người dùng 403 trước kiểm id; riêng API Moderator chỉ MODERATOR được đọc đích đã báo cáo, ADMIN đơn vai 403. Áp dụng đồng nhất cho list, detail, tin, đoạn trích, unread-count, read, block, report; kiểm UUID người khác, không tồn tại, chưa/đã báo cáo và tài khoản đa vai. Hiện ngoại lệ dữ liệu cũ tại `:134` cũng cần tương thích quy tắc role này.

5. **Thiếu — quyền riêng tư qua các nhánh phụ.** Spec đã yêu cầu hàng đợi không trả nội dung và không log `content` (`plans/messaging.md:48`, `:114`, `:143`), nhưng chưa cấm đoạn trích/last message, dữ liệu tin lồng trong DTO, log request/response hoặc lỗi và chưa có test cho detail/list/unread-count hoặc API Moderator khi đoán id của cuộc chưa báo cáo (`:58`–`:63`, `:102`, `:150`). Quy định không trả nội dung/đoạn trích tin trong mọi trường hàng đợi, chỉ cho người tham gia lấy đoạn trích của chính họ; không log body, đoạn trích, lỗi chứa nội dung. Lưu ý `description`/`note` do người dùng tự nhập có thể chứa trích dẫn: cần nói rõ chúng là dữ liệu báo cáo được Moderator xem, không hứa hệ thống ngăn rò rỉ do người báo cáo tự sao chép. Bổ sung ca kiểm đúng các ranh giới này, gồm Moderator không có báo cáo, ADMIN đơn vai và role kép, không làm thay đổi nội dung báo cáo diễn đàn (`plans/forum-reports.md:110`).

6. **Sai — sửa migration đã chạy.** Task 1a tạo và kiểm migration, 1b lại sửa cùng file (`plans/messaging.md:19`, `:38`, `:56`, `:98`, `:112`); Flyway có checksum, chạy 1a trước 1b sẽ gây lỗi validate. Giữ một migration bằng cách đưa cả sửa CHECK/trigger vào 1a (schema của `forum-reports` phải sẵn sàng), 1b chỉ nối nghiệp vụ; hoặc cho phép hai migration bất biến. Nêu rõ task 1a/1b có thể chạy và kiểm độc lập theo thứ tự, không chỉnh migration đã áp dụng.

7. **Thiếu — lấy danh sách cuộc đang khóa.** Giao diện đòi tab hiển thị và mở khóa mọi cuộc đang khóa (`plans/messaging.md:211`–`:212`), backend chỉ có API đọc tin và đổi khóa theo id (`:114`–`:116`). Hàng đợi báo cáo có lọc và phân trang, không phải danh sách toàn bộ cuộc đang khóa; `forum-reports` chỉ có danh sách bài ẩn (`plans/forum-reports.md:110`, `:112`). Cần endpoint/query phân trang cho cuộc đã báo cáo và đang khóa, quy tắc quyền/lọc/DTO/mã lỗi và test; hoặc đổi yêu cầu UI theo một thiết kế có thể tìm đủ các cuộc. Bổ sung đường dẫn service/repository/DTO/test tương ứng.

8. **Thiếu — idempotency và thứ tự lỗi.** `clientId` chỉ nói cùng cuộc thì trả bản cũ (`plans/messaging.md:79`–`:82`), chưa nói cùng id khác `content`, retry sau khi bị chặn/khóa, bị rate limit/Redis lỗi hoặc quyền thay đổi thì ưu tiên thế nào. Quy tắc 409 trước 429 (`:47`) chưa xác định vị trí tra idempotency. Cần chốt so sánh nội dung sau chuẩn hóa, mã xung đột khi khác payload, thứ tự xác thực/quyền → tìm bản cũ → trạng thái/giới hạn cho retry hợp lệ, và không tiết lộ tin cuộc khác; quy định xử lý UNIQUE khi hai transaction tranh nhau, tránh đọc lại trong transaction PostgreSQL đã rollback-only. Kiểm thử retry sau mất phản hồi rồi bị chặn, payload khác và tranh chấp; `UNIQUE (sender_id, client_id)` thực sự cần bao phủ cả hai cuộc (`:56`).

9. **Thiếu — mốc đọc và bắt kịp tin.** Gửi tin tự nâng mốc tới tin gửi (`plans/messaging.md:61`) có thể đánh dấu cả tin đối phương mà người gửi chưa xem; frontend lại chỉ nói đánh dấu khi xem (`:165`). Cần quyết định rõ hành vi này và test thứ tự người kia gửi → mình gửi trước khi tải. `afterSeq` phải lấy trang **sớm nhất** sau con trỏ, có `hasMore` và tiếp tục đến hết trước khi nâng mốc đến tin thực sự đã nhận; không nhảy qua tin chưa tải khi backlog > 50 hoặc một POST thành công có `seq` cao hơn tin polling chưa nhận (`:60`, `:164`, `:174`). Nêu rõ lấy trang mới nhất/before/after, con trỏ 0, phạm vi số nguyên và định nghĩa `unread`; `:84` cần phân biệt 400 cho input sai với 200 thành công. Thêm test unit và một luồng liên quan, không cần ma trận tích hợp.

10. **Thiếu — chặn, trạng thái và thứ tự khóa.** Quy tắc actor → conversation → reports (`plans/messaging.md:46`, `:143`) phù hợp hướng của `forum-reports` (`plans/forum-reports.md:44`), nhưng thiếu cách lấy `conversation_id` từ report không khóa rồi khóa conversation trước report và kiểm lại đích/trạng thái; thiếu kết quả xác định khi gửi tranh với block/lock, báo cáo tranh với khóa/xử lý, và khi khóa gặp cuộc đã khóa (`plans/messaging.md:111`–`:116`, `:131`, `:136`). Không khóa thêm user khác sau conversation; xác định theo thứ tự lấy khóa, đặc biệt báo cáo đến sau khóa có được OPEN hay không và `LOCK_CONVERSATION` đã khóa trả gì. Điều kiện mở từ khóa có thể đổi khi thu hồi quyền/ẩn khóa: chỉ rõ thời điểm kiểm và cách đồng bộ với các đường ghi khóa học hiện có, tránh cam kết tuần tự nếu không khóa được cùng thứ tự. Thêm test cho các cuộc tranh chấp thực sự được chốt.

11. **Thiếu — bảng lỗi và test chưa phủ.** Task 1b dẫn chiếu một phần `forum-reports` nhưng không liệt kê hoặc dẫn chiếu rõ validation `targetId`, `reason`, `description`, phân trang Moderator và lỗi report không tồn tại; thiếu 401 token sai ở Moderator, 403 role/tài khoản ở block/report, lỗi id sai định dạng và 200/201 thành công gửi mới (`plans/messaging.md:118`–`:137`, `plans/forum-reports.md:115`–`:138`). Cần ghi rõ mã/copy thừa kế và ngoại lệ theo loại đích; kiểm trực tiếp 400, 403, 404, 409, 429 và 503 liên quan. `REPORT_TARGET_EMPTY` và giới hạn báo cáo cũng chưa có ca đạt rõ trong `plans/messaging.md:147`–`:151`. Không cần dựng lỗi dịch vụ ngoài khác khi spec chỉ phụ thuộc Redis.

12. **Thiếu — đường dẫn và ranh giới phụ thuộc.** Mẫu giới hạn sửa file trong danh sách (`plans/_template.md:10`–`:12`); glob `*{Conversation,Message}*.java` bao `MessageRateLimiter` theo tên dự kiến, nhưng không bao các lớp nghiệp vụ báo cáo/DTO/enum tên khác `*Report*`, test `Conversation...` nằm ngoài `messaging/**`, hay file UI quản lý dùng chung nếu phải sửa (`plans/messaging.md:20`–`:26`, `:92`, `:141`, `:217`). Liệt kê rõ các đường dẫn thực tế sau khi `forum-reports` được code, kể cả enum/action, service/repository/DTO và test bị sửa; xác định vị trí test mới. `forum-reports` đã chốt nhưng chưa code (`plans/PLAN.md:27`, `plans/forum-reports.md:253`–`:258`): không mô tả API của nó là hiện hữu, và chỉ bắt đầu khi backend **và giao diện báo cáo** phụ thuộc đã hoàn thành; rà lại tên file và hợp đồng sau khi tích hợp thực tế.

13. **Thừa — kiểm chứng và mô tả.** Không thấy yêu cầu full suite hay `scripts/verify.sh`; phạm vi lệnh ở `plans/messaging.md:103`, `:151`, `:202`, `:238` nhìn chung đúng ngân sách của `plans/_template.md:65`–`:70`. Tuy nhiên danh sách tích hợp `:102`, `:150` đang gộp nhiều thao tác vào bốn ca: giữ luồng chính và các ca riêng tư/đồng thời thiết yếu, đưa ma trận logic thuần sang unit, không nhân ma trận role × endpoint ở mức Spring. Thân spec yêu cầu “Code bằng Opus; review ... adversarial-review” (`:6`): đây là chỉ dẫn công cụ/người thực hiện, không phải đầu ra hay tiêu chí spec; bỏ khỏi thân và giữ quy trình review ở quy định dự án. Không phát hiện yêu cầu màu mới cần tính tương phản (`:196`, `:233`).

### Khuyến nghị cho bảy câu hỏi mở

Mốc `plans/PLAN.md:44` dự kiến nhắn tin ngày 27/11, cắt đầu tiên và 28/11 dự phòng; các công sức dưới đây là **ước lượng tương đối**, chưa đo, phụ thuộc backend diễn đàn hoàn thành.

1. **Giữ mặc định** một cuộc cho cặp người học–tác giả (`plans/messaging.md:245`): ít bảng và tránh nhiều hộp thư trùng. Đổi sang mỗi khóa cần đổi unique, API mở, UI và test; công sức vừa, có thêm rủi ro migration.
2. **Giữ mặc định** chỉ người đang học được mở, sau đó vẫn liên hệ (`plans/messaging.md:246`): phù hợp hỏi bài và tránh kiểm quyền khóa ở mỗi lượt gửi. Đổi sang ngừng sau thu hồi cần lưu quan hệ với khóa và xử lý nhiều khóa/quyền đồng thời; công sức vừa đến lớn.
3. **Giữ mặc định** chặn hai chiều, chỉ người chặn bỏ (`plans/messaging.md:247`): trạng thái đơn giản và rõ. Đổi chặn độc lập hai phía cần hai trạng thái, luật bỏ chặn và test đồng thời; công sức vừa.
4. **Giữ mặc định** Moderator còn đọc được sau xử lý (`plans/messaging.md:248`): cho phép xem lại khi kiểm duyệt/mở khóa và tránh phát sinh điều kiện OPEN cạnh tranh; quyền kéo dài đối với toàn bộ lịch sử, kể cả tin về sau, nên phải thể hiện rõ khi báo cáo. Đổi chỉ đọc khi OPEN thu hẹp truy cập nhưng cần xác định xem lại/mở khóa sau xử lý và xử lý báo cáo mới; công sức vừa, yêu cầu quyết định quyền riêng tư rõ ràng.
5. **Giữ mặc định** không sửa/xóa, 2.000 ký tự, 20 tin/phút (`plans/messaging.md:249`): giảm lưu trạng thái và lạm dụng. Đổi giới hạn là nhỏ; thêm sửa/xóa cần quy tắc lịch sử, báo cáo, quyền Moderator và test đồng thời, công sức lớn.
6. **Giữ mặc định** polling 5 giây/30 giây (`plans/messaging.md:250`): phù hợp mục tiêu vài giây và hạn dự án. Điều chỉnh khoảng là nhỏ nhưng cần cân tải; đổi WebSocket/SSE cần hạ tầng kết nối, phục hồi và test, công sức lớn.
7. **Giữ mặc định** loại ADMIN/MODERATOR khỏi nhắn tin, `/messages`, “Tin nhắn” (`plans/messaging.md:251`): khớp `ReaderRoute` hiện tại và giảm bề mặt quyền. Đổi quyền hai vai cần thiết kế role kép, điều hướng và test riêng tư; công sức vừa đến lớn; đổi tên/đường dẫn đơn thuần nhỏ.

### Kết luận về thân spec

- **Chặn chốt:** thống nhất 403/404 và kiểm mọi đường rò rỉ; sửa ranh giới migration 1a/1b; bổ sung nguồn danh sách cuộc bị khóa; chốt idempotency, mốc đọc/phân trang và các tranh chấp khóa; hoàn thiện bảng lỗi cùng test tương ứng; làm rõ phụ thuộc và đường dẫn sửa.
- **Không chặn:** sửa dẫn chứng DTO khóa học công khai; bỏ chỉ dẫn công cụ khỏi thân; giữ test trong ngân sách, làm rõ copy cảnh báo quyền xem của Moderator và các giả định vận hành.

### Đề xuất ngoài spec (không chặn chốt)

- **Tách sau hạn: nhật ký kiểm toán việc Moderator mở lịch sử**, chỉ ghi danh tính, cuộc trò chuyện và thời điểm, không ghi nội dung. Có ích để truy vết truy cập riêng tư; công sức vừa, cần chính sách lưu giữ và quyền xem. Không mở rộng module trước hạn nếu người dùng chưa chọn.

## Trả lời vòng 1 (Claude)

Đã đối chiếu các ý trên code và schema ngày 2026-11-15; thân spec đã sửa theo các ý Chấp nhận/Một phần.

1. **Ý 1, 3 (Đúng):** không đổi.
2. **Ý 2 — Chấp nhận.** Sửa dẫn chứng: API chi tiết khóa công khai trả `author.id` và `viewer.enrolled`; nút “Nhắn tác giả” dựa vào hai trường đó, không thêm trường vào API khóa học.
3. **Ý 4 — Chấp nhận.** Thêm “Hợp đồng mã quyền” áp cho mọi endpoint: ở API người dùng, tài khoản bị khóa hoặc mang role ADMIN/MODERATOR nhận 403 trước khi xét `id`, người đọc không tham gia nhận 404; ở API Moderator, thiếu role nhận 403, cuộc chưa bị báo cáo nhận 404. Bỏ dòng “dữ liệu cũ”. Test ghi mã cụ thể, không còn “404 hoặc 403”.
4. **Ý 5 — Chấp nhận.** Thêm quy tắc không rò qua đường phụ (đoạn trích, tin cuối, log, thông điệp lỗi) và ghi rõ `description`/ghi chú là dữ liệu người dùng tự nhập. Có ca test riêng tư ở cả hai lớp tích hợp.
5. **Ý 6 — Chấp nhận.** Phần sửa CHECK và hàm trigger của `reports` chuyển vào migration của 1a; 1b không còn migration.
6. **Ý 7 — Chấp nhận.** Thêm `GET /api/v1/moderator/conversations?locked=true` làm nguồn cho danh sách cuộc đang khóa, kèm quy tắc quyền, tham số và test.
7. **Ý 8 — Chấp nhận.** Chốt idempotency: tra `clientId` sau kiểm quyền, trước chặn/khóa và nhịp gửi; cùng cuộc trò chuyện và cùng nội dung thì trả tin đã lưu, khác đi thì 409; lưu bằng `ON CONFLICT DO NOTHING` rồi đọc lại. UNIQUE `(sender_id, client_id)` ghi rõ là trên toàn bảng.
8. **Ý 9 — Chấp nhận.** Gửi tin không còn tự nâng mốc đã đọc; định nghĩa lại `unread`; `afterSeq` trả trang sớm nhất sau mốc, giao diện lặp tới hết rồi mới nâng mốc; tách 400 và 200 ở dòng `seq`.
9. **Ý 10 — Một phần.** Đã ghi cách khóa khi đi từ báo cáo, kết quả theo thứ tự lấy khóa, và báo cáo cuộc đã khóa bị từ chối (`CONVERSATION_LOCKED`). Không đồng bộ khóa với các đường ghi của module khóa học: điều kiện “đang học” chỉ kiểm một lần bằng dữ liệu đã commit, ghi rõ là giới hạn chấp nhận.
10. **Ý 11 — Chấp nhận.** 1b thừa kế nguyên bảng báo cáo của `forum-reports`, bảng chỉ ghi phần khác theo loại đích; tách 401/403; thêm dòng định dạng chung, 201 cho gửi mới, ca test `REPORT_TARGET_EMPTY`.
11. **Ý 12 — Chấp nhận.** Ghi điều kiện bắt đầu (cả backend lẫn giao diện báo cáo của `forum-reports` đã xong), không mô tả API của nó là hiện hữu; đầu Task 1b rà tên file thật và ghi log; mọi test mới nằm ở `messaging/**`.
12. **Ý 13 — Một phần.** Bỏ “Code bằng Opus” khỏi thân spec. Giữ dòng mức rủi ro và kiểu review vòng 1 vì `CLAUDE.md` dựa vào chính dòng này để chọn `adversarial-review`. Ma trận quyền chuyển sang `ConversationRulesTest`.
13. **Bảy câu hỏi mở:** Codex khuyến nghị giữ mặc định cả bảy; Claude đồng ý. Theo lưu ý ở câu 4, hộp thoại báo cáo nay nói rõ kiểm duyệt viên sẽ xem được toàn bộ tin nhắn.
14. **Đề xuất ngoài spec (nhật ký việc Moderator mở lịch sử):** tách sau hạn, không đưa vào spec.

**Điểm yếu còn lại:** spec dựa vào API báo cáo chưa được code, tên file và hợp đồng thật có thể lệch; thứ tự khóa là quy ước; quyền đọc của Moderator kéo dài sau khi báo cáo đã xử lý và gồm cả tin về sau; một ngày (27/11) cho bốn task rủi ro cao là không đủ, nhiều khả năng bị cắt.

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)
