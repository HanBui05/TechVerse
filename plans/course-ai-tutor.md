# Course AI tutor — “Hỏi AI về bài này”

Trạng thái: xem [`PLAN.md`](PLAN.md). Spec do Claude viết (D-030); Codex chỉ ghi vào mục “Phản hồi”.

**Mục tiêu:** Người học đang mở một bài học hỏi AI bằng tiếng Việt và nhận câu trả lời dạng stream, **chỉ dựa trên nội dung chữ của chính bài đó**. Không lưu hội thoại, không tìm trên cả khóa.
**Làn:** Đầy đủ · **Rủi ro:** thường (không tiền; có dịch vụ ngoài và giới hạn lượt). Review vòng 1 dùng `review`.
**Thứ tự:** Task 1 (Backend) → Task 2 (Giao diện). Làm trong đợt module khóa học (người dùng chốt 2026-11-14, thay câu trả lời T7 “hoãn”): Task 1 sau Task 1a của [`course-payment`](course-payment.md) vì dùng luật quyền xem bài của khóa trả phí; Task 2 làm cùng đợt giao diện của `course-payment`.

## Đường dẫn thuộc module

- `server/src/main/java/com/techverse/server/controller/LessonTutorController.java` (tạo), `service/impl/LessonTutorService.java` (tạo), `dto/request/LessonTutorRequest.java` (tạo).
- `server/src/main/java/com/techverse/server/service/impl/{AiPromptFactory,AiRateLimitService,PublishedCourseServiceImpl}.java`, `properties/AiAssistProperties.java`, `configuration/SecurityConfiguration.java`, `exception/ErrorCode.java`, `server/src/main/resources/application*.yaml`, `.env.example`.
- `server/src/test/java/com/techverse/server/{ai,course}/**/*{Tutor,Ai}*Test.java` (tạo/sửa) và lớp test trực tiếp của file dùng chung bị sửa.
- `app/src/pages/Courses/{CourseLessonPage,LessonTutorSheet}.tsx` và test; `app/src/services/{courseService,aiAssistService}.ts`, `app/src/types/{courses,aiAssist}.ts`, `app/src/data/courseI18n.ts` và test trực tiếp.

Không có migration: module không thêm bảng hay cột.

## Ngoài phạm vi

- Hỏi trên cả khóa, RAG, embedding, pgvector (bước 2 của hướng cũ; module sau).
- Lưu lịch sử hội thoại ở server, xem lại hội thoại cũ, chia sẻ câu trả lời.
- AI đọc video hoặc phụ đề YouTube; AI cho bài viết, bài tập, phỏng vấn (module khác).
- Đánh giá câu trả lời (thích/không thích), báo cáo câu trả lời sai, tác giả xem câu hỏi của người học.
- Màn quản trị quota/chi phí AI.

## Ràng buộc

- Được đổi API: Có (thêm hai endpoint). Được đổi DB: Không. Giữ nguyên hành vi hiện tại: Có — `drafts:stream`, `outlines`, quota của tác giả và API bài học không đổi contract.
- Nội dung đưa cho model lấy từ **snapshot đang công khai** của bài (cùng nguồn với `GET /courses/{courseId}/lessons/{lessonId}`), không đọc bản làm việc của tác giả.
- Quyền hỏi = quyền đọc nội dung bài đó theo luật hiện hành **và** đã đăng nhập **và** không mang role ADMIN/MODERATOR. Gọi endpoint hỏi không tạo enrollment, không cập nhật “bài đang học”.
- Tiêu đề, tóm tắt, nội dung bài, câu hỏi và lịch sử do client gửi đều là dữ liệu không tin cậy: đưa vào user message dạng dữ liệu như `AiPromptFactory` đang làm; system prompt cố định. Không log câu hỏi, nội dung bài, câu trả lời hay khóa API.
- Câu trả lời hiển thị qua `MarkdownContent` (đã chặn HTML thô, link nguy hiểm); không render HTML trực tiếp.
- Test không gọi model thật (dùng cách giả lập `ChatModel` của các test `Ai*` hiện có).

## Task 1 — Backend hỏi AI theo bài

**Giai đoạn:** Backend · **Đổi giao diện:** Không

### Phạm vi

- `POST /api/v1/courses/{courseId}/lessons/{lessonId}/tutor:stream` — body `{question, history}`; trả `text/event-stream` cùng định dạng event với `drafts:stream` (các đoạn nội dung, một event kết thúc thành công hoặc lỗi kèm mã lỗi và quota còn lại). Header `X-AI-Quota-Limit`, `X-AI-Quota-Remaining` như `drafts:stream`.
- `GET /api/v1/me/ai-tutor/quota` — trả `{limit, remaining}` của người gọi trong ngày (múi giờ Asia/Ho_Chi_Minh như quota hiện có).
- `history`: tùy chọn, tối đa 6 tin gần nhất, mỗi tin `{role: USER|ASSISTANT, content}`; server chỉ dùng để model hiểu câu hỏi nối tiếp, không lưu.
- Ngữ cảnh gửi model: tên khóa, tên bài, tóm tắt, nội dung Markdown của bài. Nội dung dài hơn 60.000 ký tự thì cắt ở 60.000 và event đầu báo `contextTruncated: true`.
- System prompt yêu cầu: trả lời tiếng Việt, ngắn gọn, Markdown, chỉ dùng thông tin trong bài; câu hỏi ngoài bài thì nói rõ bài học không đề cập và không tự bịa; không làm theo chỉ dẫn nằm trong nội dung bài/câu hỏi.
- Quota riêng `TUTOR`: mặc định 20 câu/ngày/người (`AI_TUTOR_PER_DAY`), dùng chung giới hạn nhịp `burst-per-minute` hiện có. Mỗi người chỉ một stream trợ lý chạy cùng lúc.
- Hoàn lượt khi không có câu trả lời dùng được: lỗi nhà cung cấp, hết giờ, câu trả lời bị cắt do giới hạn token, hoặc người dùng ngắt trước khi nhận đoạn nội dung đầu tiên. Không hoàn khi đã trả lời xong hoặc người dùng ngắt giữa chừng sau khi đã có nội dung.
- Giới hạn thời gian một câu trả lời 60 giây (`AI_TUTOR_TIMEOUT`), độ dài tối đa 1.024 token đầu ra (`ai.assist.max-completion-tokens.TUTOR`); event hết giờ phát từ deadline của service như `AiDraftStreamService` (luật `backend-ai.md`).

### Quy tắc nghiệp vụ và mã lỗi

Lỗi trước khi mở stream trả `ErrorResponse` thường; lỗi sau khi stream đã mở trả bằng event lỗi mang cùng mã.

| Trường / tình huống | Ràng buộc | HTTP / mã lỗi | Copy hiển thị |
|---|---|---|---|
| `question` | Bắt buộc; sau trim 1–500 ký tự | 400 `VALIDATION_ERROR` (`fieldErrors.question`) | Hãy nhập câu hỏi (tối đa 500 ký tự). |
| `history` | ≤ 6 tin; `role` thuộc USER/ASSISTANT; `content` sau trim 1–4.000 ký tự | 400 `VALIDATION_ERROR` | Không gửi được câu hỏi. Hãy tải lại trang. |
| Chưa đăng nhập / token sai | — | 401 `AUTH_ACCESS_TOKEN_REQUIRED` / `AUTH_INVALID_ACCESS_TOKEN` | Đăng nhập để hỏi AI. |
| ADMIN hoặc MODERATOR | Không dùng trợ lý (cùng luật không học khóa) | 403 `ACCESS_DENIED` | Bạn không có quyền. |
| Khóa hoặc bài không tồn tại, không công khai, bài không thuộc snapshot hiện hành | Không lộ sự tồn tại | 404 `COURSE_NOT_FOUND` / `LESSON_NOT_FOUND` | Không tìm thấy khóa học / bài học. |
| Khóa trả phí, chưa mua, bài không phải học thử | Theo luật 1a của `course-payment` | 403 `COURSE_PURCHASE_REQUIRED` | Hãy mua khóa học để tiếp tục. |
| Khóa miễn phí, chưa bắt đầu học, bài không phải học thử | Không tự tạo enrollment | 403 `ACCESS_DENIED` | Hãy mở bài học trước khi hỏi AI. |
| Bài học thử, người đã đăng nhập chưa enroll | Được hỏi | 200 stream | — |
| Bài không có nội dung chữ (chỉ video) | Không gọi model, không trừ lượt | 409 `AI_TUTOR_LESSON_NO_CONTENT` | Bài này chưa có nội dung chữ để AI dựa vào. |
| Đang có một stream trợ lý của chính người này | Không mở stream thứ hai, không trừ lượt | 409 `AI_GENERATION_IN_PROGRESS` | AI đang trả lời câu trước. |
| Quá nhịp trong một phút | Dùng `burst-per-minute` | 429 `AI_RATE_LIMITED` | Bạn hỏi quá nhanh, hãy thử lại sau ít phút. |
| Hết 20 câu trong ngày | — | 429 `AI_QUOTA_EXCEEDED` | Bạn đã dùng hết lượt hỏi AI hôm nay. |
| Chưa cấu hình AI (model `none`, thiếu khóa) | Không trừ lượt | 500 `AI_CONFIGURATION_INVALID` | Trợ lý AI chưa sẵn sàng. |
| Redis lỗi khi giữ lượt | Không gọi model | 503 `AI_STORAGE_UNAVAILABLE` | Trợ lý AI tạm thời không khả dụng. |
| Nhà cung cấp lỗi / từ chối / sai khóa / quá tải | Hoàn lượt; ánh xạ bằng `AiProviderExceptionMapper` | `AI_PROVIDER_UNAVAILABLE` / `AI_PROVIDER_REQUEST_REJECTED` / `AI_PROVIDER_AUTH_FAILED` / `AI_PROVIDER_RATE_LIMITED` | Dịch vụ AI đang gián đoạn. Hãy thử lại. |
| Hết 60 giây | Hoàn lượt | `AI_TIMEOUT` | AI phản hồi quá lâu. Hãy thử lại. |
| Câu trả lời bị cắt do giới hạn token | Hoàn lượt; phần đã stream vẫn hiển thị kèm cảnh báo | `AI_OUTPUT_TRUNCATED` | Câu trả lời bị cắt. Hãy hỏi cụ thể hơn. |
| Người dùng ngắt kết nối | Dừng gọi model; hoàn lượt chỉ khi chưa có đoạn nội dung nào | — | — |
| Thành công | Trừ một lượt; event kết thúc trả quota còn lại | 200 | — |

### Kế hoạch thực thi

- **File cần đụng:** `LessonTutorController` (hai endpoint, `@PreAuthorize("isAuthenticated()")`); `LessonTutorService` (kiểm quyền → lấy nội dung snapshot → giữ lượt → stream → hoàn lượt); `AiPromptFactory` thêm `TUTOR_SYSTEM` + `tutor(...)`; `AiRateLimitService.Kind` thêm `TUTOR`; `AiAssistProperties` thêm `tutorPerDay`, `tutorTimeout` và khóa token `TUTOR`; `SecurityConfiguration` thêm matcher `POST /api/v1/courses/*/lessons/*/tutor:stream` và `GET /api/v1/me/ai-tutor/quota` là `authenticated` (đặt trước dòng `permitAll` của GET course); `ErrorCode` thêm `AI_TUTOR_LESSON_NO_CONTENT`.
- **Phần dùng lại:** luật đọc bài trong `PublishedCourseServiceImpl.lesson(...)` — tách phần kiểm quyền + lấy `CourseVersionLesson` thành một hàm dùng chung cho cả GET bài và trợ lý, GET bài giữ nguyên hành vi (vẫn tự enroll khóa miễn phí, vẫn `touch`); `AiPromptFactory.options(...)`; `AiProviderExceptionMapper`; cách phát event và deadline của `AiDraftStreamService`; `AiGenerationRegistry` nếu phù hợp để chặn stream thứ hai.
- **Bẫy đã biết:** option runtime phải dựng từ default options (`backend-ai.md`); `SseEmitter.onTimeout` không gửi được event; transaction đọc DB phải đóng trước khi gọi model (không giữ kết nối DB suốt lúc stream); `AiAssistProperties` kiểm token 512–65536 theo danh sách khóa cố định — thêm `TUTOR` vào danh sách và YAML cùng lúc, nếu không context không khởi động; matcher `permitAll` của GET `/api/v1/courses/**` không được che endpoint POST mới.

### Xong khi

- [ ] `AiPromptFactoryTest` (unit): prompt trợ lý chứa đủ tên khóa/bài/tóm tắt/nội dung dạng dữ liệu, lịch sử đúng thứ tự, cắt ở 60.000 ký tự và báo `contextTruncated`.
- [ ] `LessonTutorServiceTest` (unit, model giả): thành công trừ một lượt; từng dòng lỗi nhà cung cấp/hết giờ/bị cắt hoàn lượt; ngắt trước và sau đoạn đầu; bài không có nội dung không gọi model; stream thứ hai bị chặn.
- [ ] `LessonTutorControllerTest` (`@WebMvcTest`): validation `question`/`history` từng biên (0, 1, 500, 501 ký tự; 6 và 7 tin; role lạ), 401, mapping mã lỗi trước khi mở stream.
- [ ] `LessonTutorIntegrationTest` (DB/security thật, model giả, dùng `CourseIntegrationTestBase`): học viên đã enroll hỏi được; bài học thử với người chưa enroll hỏi được; khóa miễn phí chưa bắt đầu → 403 và **không** sinh enrollment; ADMIN/MODERATOR → 403; bài chỉ video → 409; hết quota → 429; `GET /me/ai-tutor/quota` đúng sau mỗi lần.
- [ ] Ca khóa trả phí chưa mua → 403 `COURSE_PURCHASE_REQUIRED`: thêm vào lớp trên sau khi Task 1a của `course-payment` xong (nếu Task 1 này làm trước thì ghi “chưa kiểm” trong log).
- [ ] Regression: `CourseLearningIntegrationTest`, `PublishedCourseIntegrationTest` (hàm đọc bài đã tách) và các lớp `Ai*` gọi `AiRateLimitService`/`AiAssistProperties`/`AiPromptFactory` đạt. Full backend do CI chạy khi mở PR.

## Task 2 — Giao diện “Hỏi AI về bài này”

**Giai đoạn:** Giao diện · **Đổi giao diện:** Có

### Phạm vi

- Trang bài học (`CourseLessonPage`) thêm nút “Hỏi AI về bài này” cạnh tiêu đề bài. Bấm mở bảng trượt bên phải (`Sheet` có sẵn; trên mobile chiếm toàn màn hình): danh sách hỏi–đáp của phiên, ô nhập, nút Gửi, nút Dừng khi đang trả lời, dòng “Còn x/20 câu hôm nay”, dòng lưu ý AI có thể sai.
- Hội thoại chỉ giữ trong bộ nhớ trang: đóng bảng rồi mở lại vẫn còn; chuyển sang bài khác hoặc tải lại trang thì xóa. Mỗi lần gửi kèm tối đa 6 tin gần nhất.
- Hiện nút khi: đã đăng nhập, không phải ADMIN/MODERATOR, đang đọc được nội dung bài. Guest: nút dẫn sang đăng nhập rồi quay lại bài (cơ chế `returnTo` hiện có). Bài chỉ có video: nút bị vô hiệu kèm câu giải thích.
- Câu trả lời hiện dần theo stream, render bằng `MarkdownContent`. Lỗi hiện ngay dưới câu hỏi tương ứng, có nút “Thử lại” cho lỗi tạm thời; phần đã nhận trước khi lỗi vẫn giữ.
- Validation phía client theo bảng Task 1 (1–500 ký tự, đếm ký tự hiển thị từ 400). Không tự trừ quota ở client: lấy từ header/event của server và `GET /me/ai-tutor/quota` khi mở bảng.

### Kế hoạch thực thi

- **File cần đụng:** `LessonTutorSheet.tsx` (tạo: toàn bộ bảng trượt và trạng thái hội thoại), `CourseLessonPage.tsx` (nút + gắn sheet, xóa hội thoại khi đổi `lessonId`), `courseService.ts` (gọi stream + quota), `courseI18n.ts` (copy), types.
- **Phần dùng lại:** `parseSse`, `quotaOf` trong `aiAssistService.ts` (đang dùng cho `drafts:stream`); `Sheet`, `Button`, `Textarea`; `MarkdownContent`; `returnTo`; cách ánh xạ mã lỗi AI sang copy của `aiAssistI18n` cho các mã trùng.
- **Bẫy đã biết:** hủy stream bằng `AbortController` khi bấm Dừng, đóng trang hoặc đổi bài; khóa nút Gửi khi đang stream; chuỗi dài trong test dùng `user.paste`; vùng chạm 44px cho nút trong sheet (`pointer-coarse:min-h-11`); không assert class Tailwind.

### Copy vi/en

| Khóa / trạng thái | vi | en |
|---|---|---|
| Nút mở | Hỏi AI về bài này | Ask AI about this lesson |
| Tiêu đề bảng | Trợ lý AI của bài học | Lesson AI assistant |
| Lưu ý | AI chỉ dựa trên nội dung chữ của bài này và có thể trả lời sai. Hãy đối chiếu với bài học. | The AI only uses this lesson's text and can be wrong. Check against the lesson. |
| Trống | Hỏi bất cứ điều gì bạn chưa hiểu trong bài. | Ask about anything unclear in this lesson. |
| Ô nhập | Nhập câu hỏi của bạn… | Type your question… |
| Gửi / Dừng / Thử lại | Gửi / Dừng / Thử lại | Send / Stop / Retry |
| Quota | Còn {remaining}/{limit} câu hôm nay | {remaining}/{limit} questions left today |
| Hết quota | Bạn đã dùng hết lượt hỏi AI hôm nay. | You have used all AI questions for today. |
| Bài chỉ video | Bài này chưa có nội dung chữ để AI dựa vào. | This lesson has no text for the AI to use. |
| Guest | Đăng nhập để hỏi AI | Sign in to ask AI |
| Nội dung bị cắt | Bài học dài nên AI chỉ đọc phần đầu. | This lesson is long, so the AI only read the first part. |
| Đang trả lời câu trước | AI đang trả lời câu trước. | The AI is still answering the previous question. |
| Hỏi quá nhanh | Bạn hỏi quá nhanh, hãy thử lại sau ít phút. | Too many questions; try again shortly. |
| Dịch vụ gián đoạn | Dịch vụ AI đang gián đoạn. Hãy thử lại. | The AI service is temporarily unavailable. Try again. |
| Quá lâu | AI phản hồi quá lâu. Hãy thử lại. | The AI took too long. Try again. |
| Bị cắt | Câu trả lời bị cắt. Hãy hỏi cụ thể hơn. | The answer was cut off. Try a more specific question. |
| Chưa sẵn sàng | Trợ lý AI chưa sẵn sàng. | The AI assistant is not ready. |
| Cần mua | Hãy mua khóa học để tiếp tục. | Buy this course to continue. |
| Lỗi nhập | Hãy nhập câu hỏi (tối đa 500 ký tự). | Enter a question (up to 500 characters). |

### UI

- Bám [`docs/design/UI_GUIDE.md`](../docs/design/UI_GUIDE.md); chỉ dùng primitive và token hiện có, không thêm màu. Câu hỏi của người học căn phải trên nền `muted`; câu trả lời AI căn trái, không nền, có nhãn “AI”. Chữ lỗi dùng `text-danger`.
- Trạng thái: trống, đang trả lời (con trỏ nhấp nháy cuối đoạn, nút Dừng), xong, lỗi có/không có phần đã nhận, hết quota (ô nhập khóa), bài chỉ video, guest.
- Desktop: sheet rộng khoảng 420px, không che mục lục bên phải khi đóng. Mobile 390px: toàn màn hình, ô nhập dính đáy, không cuộn ngang. Tự cuộn xuống tin mới nhất khi đang stream trừ khi người dùng đã cuộn lên.
- Trợ năng: sheet có tiêu đề, focus vào ô nhập khi mở, trả focus về nút khi đóng; vùng câu trả lời `aria-live="polite"`; Enter gửi, Shift+Enter xuống dòng.

### Xong khi

- [ ] `LessonTutorSheet.test.tsx`: gửi câu hỏi → stream hiện dần → quota cập nhật; validation biên 0/500/501; Dừng hủy stream; từng mã lỗi trong bảng Task 1 ra đúng copy vi/en; hết quota khóa ô nhập; gửi kèm đúng 6 tin gần nhất.
- [ ] `CourseLessonPage.test.tsx`: nút hiện/ẩn/vô hiệu đúng theo vai trò, guest và bài chỉ video; đổi bài xóa hội thoại.
- [ ] `courseService.test.ts`, `courseI18n.test.ts` (đủ khóa vi/en) + `npm run build` trong `app/` đạt (không chạy full `npm test`).
- [ ] Kiểm bằng mắt `CourseLessonPage` có sheet mở: dark/light × desktop/mobile, một lượt; ghi log.

## Câu hỏi mở cần người dùng chốt

Đã chốt 2026-11-14: cả bốn câu giữ mặc định (xem “Quyết định của người dùng”).

1. **Giới hạn 20 câu/ngày/người** — giữ, hay số khác?
2. **Không lưu hội thoại** (tải lại trang là mất) — giữ, hay lưu để xem lại (thêm bảng DB, thêm khoảng một ngày công)?
3. **Người chưa học khóa hỏi được ở bài “Học thử”** (cần đăng nhập) — giữ, hay chỉ người đã vào học mới hỏi được?
4. **Không có file wireframe riêng** vì chỉ thêm một nút và một bảng trượt đã mô tả ở mục UI; bạn duyệt bằng kiểm mắt sau khi code — giữ, hay vẫn muốn wireframe trước?

## Phản hồi vòng 1 (Codex)

Đúng / Sai / Thiếu / Thừa:

### Đề xuất ngoài spec (không chặn chốt)

## Trả lời vòng 1 (Claude)

## Phản hồi vòng 2 (Codex)

## Trả lời vòng 2 (Claude)

## Quyết định của người dùng

- 2026-11-14: làm trợ lý AI của khóa ngay trong đợt module khóa học (thay T7 “hoãn”).
- **Người dùng chốt spec 2026-11-14** (“chốt như vậy với module khóa học”). Bốn câu hỏi mở giữ mặc định: 20 câu/ngày/người; không lưu hội thoại; bài “Học thử” hỏi được khi đã đăng nhập; không có wireframe riêng, duyệt bằng kiểm mắt.
- Chốt trước khi Codex phản biện: các mục “Phản hồi/Trả lời” để trống. Nếu chạy phản biện sau, phát hiện phải sửa ghi vào log module.
