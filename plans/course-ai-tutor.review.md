# Course AI tutor — lịch sử phản biện spec

Chuyển từ [`course-ai-tutor.md`](course-ai-tutor.md) khi người dùng chốt (2026-11-17). Kết luận nằm ở mục “Quyết định của người dùng” của spec.

## Phản hồi vòng 1 (Codex)

- **Đúng:** Thứ tự Backend → Giao diện phù hợp `plans/PLAN.md`; quyền dùng snapshot hiện hành, bài học thử cho người đăng nhập và bài trả phí cần enrollment active phù hợp `PublishedCourseServiceImpl.lesson()` / `enrollment()` trong `server/src/main/java/com/techverse/server/service/impl/PublishedCourseServiceImpl.java`. `CourseAccessService` phục vụ khóa của tác giả, còn `LessonAiContextService.resolve()` chỉ lấy taxonomy bản làm việc cho tác giả; không dùng chúng làm quyền đọc snapshot.
- **Sai:** Bài miễn phí không học thử, chưa enroll hiện trả 403 `LESSON_PREVIEW_ONLY`, không phải `ACCESS_DENIED`; GET bài **không tự enroll**, chỉ `start()` mới `insertFree()`, còn `lesson()` chỉ `touch` nếu đã enroll. Cần thống nhất bảng, kế hoạch tách hàm và test với code thật, giữ nguyên contract GET.
- **Thiếu:** Chủ khóa không được tính là enrolled kể cả có bản ghi; `Reader.canLearn()` và `enrollment()` khiến chủ khóa chỉ đọc bài preview và bài thường trả `ACCESS_DENIED`. Chủ khóa đăng nhập hỏi bài preview có được phép không? Bảng cũng thiếu `USER_INACTIVE` (403 từ `reader()`), ca enrollment không còn active và test tương ứng. `GET /api/v1/me/ai-tutor/quota` chưa nói rõ quyền ADMIN/MODERATOR, lỗi Redis khi đọc quota và copy.
- **Thiếu:** Bảng chưa định nghĩa body JSON sai/null, phần tử history null hoặc thiếu role/content, mã HTTP cụ thể cho lỗi provider trước stream, và kết quả khi hoàn lượt gặp lỗi Redis. `AiRateLimitService.refund()` hiện chỉ thử một lần, trả null khi Redis lỗi, nên cam kết “hoàn lượt” và quota sau lỗi chưa được bảo đảm; cần nêu hành vi và test đúng ca lỗi. Các dòng quyền, nhịp, cấu hình, Redis và một số biên history chưa có ca cụ thể trong “Xong khi”.
- **Sai:** Thiếu khóa khi bật model không trả 500 cho request: `AiAssistConfiguration.verify()` làm ứng dụng không khởi động; model `none` mới không có `ChatModel`. Cần sửa bảng theo hành vi mong muốn và nêu rõ nếu định thay đổi cấu hình hiện tại.
- **Thiếu:** `AiAssistConfiguration.verify()` chỉ so MVC async timeout với `longestDraftTimeout()`, chưa tính timeout tutor có thể cấu hình; bổ sung đường dẫn, kiểm tra cấu hình và test trực tiếp để deadline service chạy trước timeout MVC. `AiRateLimitService` dùng cùng burst key cho mọi kind: thêm TUTOR sẽ ảnh hưởng nhịp AI tác giả, cần nêu rõ đó là chủ ý và kiểm regression.
- **Thiếu:** `AiGenerationRegistry` ở bộ nhớ một instance và dùng chung slot cho draft của tác giả; dùng nguyên trạng không bảo đảm một stream tutor trên nhiều instance và có thể chặn chéo `POST /api/v1/author/ai/drafts:stream`. Cần chốt phạm vi triển khai và quan hệ hai loại stream. `AiDraftStreamService` chỉ dọn khi disconnect, không hoàn lượt; `AbortController` không có xác nhận hủy từ server, nhất là trước delta đầu. Cần thiết kế/test dừng, hoàn lượt đúng một lần và cập nhật quota; nếu cần API hủy thì Task 1 phải cung cấp trước Task 2, điều chỉnh số endpoint.
- **Thiếu:** `AiStreamEvent.Metadata` hiện chỉ có generationId/timeoutSeconds; `parseSse` lọc tên event cố định trong `app/src/services/aiAssistService.ts`. Cần xác định trường `contextTruncated` trên event nào, schema terminal/quota khi hoàn thất bại và test parser. Không thể chỉ nói “cùng định dạng” rồi thêm event không được parser nhận.
- **Thiếu:** Prompt không bảo đảm tuyệt đối model chỉ dựa vào bài: `AiPromptFactory` và `ChatModel` chỉ đưa chỉ dẫn, trong khi history do client gửi có thể chứa thông tin ngoài bài. Cần mô tả giới hạn này, quyết định xử lý history và xác định cách giới hạn tổng input/token, chi phí cho 60.000 ký tự + 6 × 4.000 ký tự; chưa có chính sách khi provider từ chối vì vượt context.
- **Sai:** Câu “không có wireframe riêng” và câu hỏi mở số 4 mâu thuẫn quyết định mới tại `CLAUDE.md` và `plans/PLAN.md` ngày 2026-11-16: Task 2 phải có `plans/course-ai-tutor.wireframe.md` desktop/mobile được duyệt sau backend, trước code. Đường dẫn module và thứ tự công việc cần phản ánh cổng này.
- **Thừa / thiếu:** `LessonTutorIntegrationTest` đang yêu cầu ít nhất 7 ca DB/security, vượt mức khoảng 3–5 ca/endpoint; chuyển validation, role và quota thuần sang unit/`@WebMvcTest`, giữ tích hợp cho quyền snapshot/enrollment thực sự cần DB. Ma trận từng mã lỗi × vi/en trong `LessonTutorSheet.test.tsx` nên chuyển sang unit mapping; render chỉ giữ luồng chính. `app/src/App.tsx` đang chặn manager bằng `ReaderRoute`, còn `CourseLessonPage` chỉ nhận `authenticated`; nếu cần truyền role hoặc kiểm route thì bổ sung đường dẫn/test trực tiếp thay vì giả định trang có role.

### Đề xuất ngoài spec (không chặn chốt)

- Tách module sau: đo và theo dõi mức dùng/chi phí AI tổng hợp không chứa nội dung người học; lợi ích là kiểm soát ngân sách, công sức vừa vì cần cơ chế thu thập và vận hành riêng.

## Trả lời vòng 1 (Claude)

Đánh số theo thứ tự gạch đầu dòng của Codex. Đã kiểm bằng code; phần chấp nhận đã sửa vào thân spec.

1. **Đúng** — ghi nhận; quyền xem lấy từ `PublishedCourseServiceImpl`, không dùng `CourseAccessService`/`LessonAiContextService`.
2. **Chấp nhận.** `PublishedCourseServiceImpl.java:131-138`: bài miễn phí không học thử, chưa enroll → 403 `LESSON_PREVIEW_ONLY`; `lesson()` chỉ `touch` khi đã enroll, chỉ `start()` (`:163`) mới `insertFree`. Sửa dòng bảng, copy và “Phần dùng lại” (GET bài giữ nguyên contract).
3. **Một phần.** Quyền trợ lý = đúng luật GET bài, kể cả chủ khóa (`Reader.canLearn`, `:43`): chủ khóa hỏi được bài học thử, bài thường → 403 `ACCESS_DENIED`. Thêm dòng `USER_INACTIVE` (`:226`). Enrollment không active = chưa enroll (`findActive`), đã nằm trong các dòng có sẵn. `GET /me/ai-tutor/quota`: chỉ cần đăng nhập, không chặn ADMIN/MODERATOR (vô hại, trang đã bị `ReaderRoute` chặn); Redis lỗi → 503 `AI_STORAGE_UNAVAILABLE` (`AiRateLimitService.peek` đã ném).
4. **Một phần.** JSON hỏng → 400 `MALFORMED_REQUEST` (`GlobalExceptionHandler.java:74`, có sẵn); phần tử `history` null/thiếu `role`/`content` → 400 `VALIDATION_ERROR`. **Từ chối** mã HTTP riêng cho lỗi nhà cung cấp: theo mẫu `AiDraftStreamService`, model chỉ được gọi sau khi emitter đã mở nên lỗi nhà cung cấp luôn là event. Hoàn lượt lỗi Redis: `refund()` trả null (`AiRateLimitService.java:97-110`) → lượt mất, event mang `quotaRemaining: null`, client gọi lại `GET /me/ai-tutor/quota`; ghi vào bảng + một ca unit.
5. **Chấp nhận.** `AiAssistConfiguration.java:16-17`: model `none` → không có `ChatModel` → 500 `AI_CONFIGURATION_INVALID` (như `AiDraftStreamService.java:130`); bật model mà thiếu khóa là lỗi khởi động có sẵn, không đổi. Sửa dòng bảng.
6. **Chấp nhận cả hai.** `AiAssistProperties.longestDraftTimeout()` (`:44`) chỉ xét draft → đổi thành thời hạn dài nhất của mọi loại (thêm `tutorTimeout`), một ca trong test có sẵn của `AiAssistConfiguration`; thêm file vào “Đường dẫn”. Burst chung (`AiRateLimitService.java:76`) là chủ ý: 3 câu/phút cho mọi loại AI của một người; ghi vào Ràng buộc.
7. **Một phần.** Chấp nhận slot riêng theo loại: `AiGenerationRegistry.start` (`:52`) đang chặn theo người → thêm khóa loại (DRAFT/TUTOR) để soạn nháp và hỏi trợ lý không chặn chéo. Nhiều instance: giữ giới hạn một instance đã ghi `shortcut:` (`:20`), không mở rộng. **Từ chối** API hủy: hoàn lượt dựa vào việc đã `send` được `Delta` nào chưa — client ngắt làm `send` ném lỗi/`onError`; chưa có Delta thành công → `refund` một lần (idempotent qua khóa `ai:refund:<op>`, `:102`). Sau Dừng client gọi lại quota. Giữ hai endpoint.
8. **Một phần.** Tên event không đổi nên `parseSse` (`aiAssistService.ts:5`) vẫn nhận. Chốt: thêm `contextTruncated` (boolean) vào `AiStreamEvent.Metadata`, `drafts:stream` luôn gửi `false` (chỉ thêm trường). Event kết thúc dùng `Completed`/`Error`/`Cancelled` có sẵn (`quotaRemaining` Integer, null khi hoàn lỗi).
9. **Một phần.** Ghi rõ giới hạn: prompt chỉ giảm chứ không bảo đảm “chỉ dựa vào bài”. Giảm `history.content` xuống 1–2.000 ký tự → tổng input tối đa khoảng 72.000 ký tự (~20k token), dưới context của `openai/gpt-oss-120b` (`application.yaml:25`); nhà cung cấp từ chối vì quá context → `AI_PROVIDER_REQUEST_REJECTED`, hoàn lượt (dòng có sẵn). **Thêm (của Claude):** `gpt-oss` là model suy luận, token suy luận tính vào `max-completion-tokens` → 1.024 dễ bị cắt; nâng `TUTOR` lên 2.048 (bằng `OUTLINE`, `application.yaml:79`).
10. **Chấp nhận.** Luật `CLAUDE.md` 2026-11-16 thắng câu hỏi mở 4: Task 2 có `plans/course-ai-tutor.wireframe.md` (desktop + mobile, đủ trạng thái), viết sau Task 1 và dừng chờ duyệt.
11. **Chấp nhận.** Tích hợp còn 5 ca: đã enroll hỏi được; học thử chưa enroll hỏi được; miễn phí chưa bắt đầu → 403 `LESSON_PREVIEW_ONLY` và không sinh enrollment; trả phí chưa mua → 403 `COURSE_PURCHASE_REQUIRED` (`course-payment` đã vào `main` 2026-11-17, bỏ câu “chưa kiểm”); ADMIN → 403. Bài chỉ video, hết quota, `USER_INACTIVE`, Redis → unit service; quota GET → `@WebMvcTest`. Frontend: ma trận mã lỗi × vi/en chuyển sang unit test hàm ánh xạ; `ReaderRoute` (`App.tsx:176`) đã chặn manager nên bỏ tiêu chí “ẩn theo vai trò” khỏi `CourseLessonPage.test.tsx`.
12. **Đề xuất ngoài spec (theo dõi chi phí AI):** đồng ý tách module sau; người dùng không chọn thì ghi vào “Câu hỏi mở” của `PLAN.md`.

**Sửa thêm (Claude tự thấy):** dòng “Thứ tự” và mục “Xong khi” còn viết như thể `course-payment` chưa xong → cập nhật.

**Điểm yếu còn lại của spec:**
- Chi phí: ở mức trần mỗi người dùng đủ 20 câu với bài dài là khoảng 400k token input/ngày; chưa có trần chi phí toàn hệ thống (đề xuất 12 tách module).
- Token suy luận của `gpt-oss` chưa đo trên câu hỏi thật; 2.048 là ước lượng, có thể phải chỉnh sau smoke test.
- Ngắt kết nối chỉ phát hiện ở lần `send` kế tiếp: người dùng bấm Dừng trước đoạn đầu thì model vẫn chạy tới Delta đầu (vẫn tốn token dù đã hoàn lượt).
- Chặn một stream/người chỉ đúng khi chạy một instance.

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)
