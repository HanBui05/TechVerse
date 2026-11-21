# Prompt cho Gemini — giao diện module “Ôn phỏng vấn”

Bạn đang làm frontend cho TechVerse (React + TypeScript + Vite trong `app/`). Backend của module “Interview practice” (ngân hàng câu hỏi phỏng vấn) đã xong và đã test. Nhiệm vụ của bạn: dựng **toàn bộ giao diện** của module, gồm phần Tác giả, Moderator và Người học. Toàn bộ chữ trên giao diện có hai ngôn ngữ vi/en như các trang hiện có.

## 1. Tuyệt đối không

- **Không sửa bất kỳ file nào trong `server/`** (kể cả `SecurityConfiguration`, migration, test). Nếu thấy backend thiếu gì, ghi vào cuối câu trả lời, đừng tự sửa.
- Không sửa file của module khác ngoài các file dùng chung được liệt kê ở mục 4.
- Không thêm thư viện mới vào `package.json`.
- Không commit, không push.

## 2. Đọc trước khi code

**Yêu cầu nghiệp vụ (nguồn chính):** `plans/interview-practice.md`: đọc “Ràng buộc chung”, “Trạng thái câu hỏi”, bảng “Quy tắc nghiệp vụ và mã lỗi” của Task 1a, 1b, 1c (lấy cột “Copy hiển thị” làm câu báo lỗi), và toàn bộ Task 2a, Task 2b (phạm vi, copy vi/en, bẫy đã biết, “Xong khi”). Bỏ qua mục “Cổng wireframe”, mục này đã được bỏ.

**Backend (chỉ đọc để biết API, kiểu dữ liệu, mã lỗi):**

- `server/src/main/java/com/techverse/server/controller/AuthorInterviewController.java`: `/api/v1/author/interview-questions` (danh sách, chi tiết, `options`, tạo, sửa PATCH có `version`, `submit`, `withdraw`, `visibility`, `copy`, xóa, `ai/drafts`).
- `server/src/main/java/com/techverse/server/controller/ModeratorInterviewController.java`: `/api/v1/moderator/interview-questions` (danh sách, chi tiết, `review`, `publication`).
- `server/src/main/java/com/techverse/server/controller/PublishedInterviewController.java`: `/api/v1/interview-questions` (danh sách, `options`, chi tiết, `answer`, `mark`, `feedback`) và `/api/v1/me/interview-feedback/quota`.
- `server/src/main/java/com/techverse/server/dto/request/InterviewQuestionRequest.java`: mọi body/query, kèm giới hạn validation (độ dài, pattern) để làm validation phía client giống hệt.
- `server/src/main/java/com/techverse/server/dto/response/InterviewQuestionResponse.java`: mọi kiểu trả về (tác giả, moderator, công khai, đáp án, viewer/mark).
- `server/src/main/java/com/techverse/server/service/impl/InterviewAiService.java`: kiểu kết quả nhận xét AI (`verdict` GOOD/PARTIAL/OFF_TRACK, `strengths`, `missing`, `advice`) và kết quả sinh câu (`questions`, `requested`).
- `server/src/main/java/com/techverse/server/service/impl/{AuthorInterviewService,ModeratorInterviewService,PublishedInterviewService}.java`: khi nào ném lỗi nào (đọc lướt).
- `server/src/main/java/com/techverse/server/enums/{InterviewStatus,InterviewLevel}.java`.
- `server/src/main/java/com/techverse/server/exception/ErrorCode.java`: các mã `INTERVIEW_*` và `AI_*` (status HTTP + mã).
- `server/src/main/java/com/techverse/server/dto/response/{ApiResponse,PageResponse,AiQuotaResponse}.java`, `exception/ErrorResponse.java`: vỏ phản hồi, phân trang, quota (`AiQuotaResponse` có thêm trường `interviewDraft`).
- Header quota trên phản hồi AI: `X-AI-Quota-Limit`, `X-AI-Quota-Remaining`.

**Frontend: mẫu phải bám theo (module “Bài tập” có cùng vòng đời và cấu trúc, hãy làm giống về cách tổ chức code, gọi API, xử lý lỗi, test):**

- Tác giả: `app/src/pages/Author/Exercises/AuthorExercisesPage.tsx`, `ExerciseEditorPage.tsx` (+ `.test.tsx`).
- Moderator: `app/src/pages/Moderator/Exercises/ModeratorExercisesPage.tsx`, `ModeratorExerciseDetailPage.tsx` (+ `.test.tsx`).
- Người học: `app/src/pages/Practice/PracticeListPage.tsx` (danh sách + bộ lọc trên URL), `app/src/pages/Courses/*` (trang chi tiết công khai).
- AI: `app/src/pages/Author/Courses/CourseAiSheet.tsx`, `app/src/services/aiAssistService.ts`, `app/src/data/aiAssistI18n.ts` (ánh xạ lỗi AI), `app/src/types/aiAssist.ts`.
- Dịch vụ, kiểu, i18n: `app/src/services/exerciseService.ts`, `app/src/types/exercises.ts`, `app/src/data/exerciseI18n.ts`, `app/src/services/api/client.ts`.
- Dùng lại: `components/MarkdownContent.tsx`, `components/EmptyState.tsx`, `components/Pagination.tsx`, `components/articles/ArticleSaveButton.tsx` (chỉ phần `SaveToggle`), `services/returnTo.ts`, các primitive trong `components/ui/`.
- Định tuyến, menu: `app/src/App.tsx` (`ReaderRoute`, route tác giả/moderator), `app/src/components/layout/{Sidebar,ModeratorSidebar}.tsx`, `app/src/data/{navigation,managementI18n}.ts`.
- Hướng dẫn giao diện: `docs/design/UI_GUIDE.md`.

## 3. Các trang cần tạo (7 trang + 1 hộp thoại)

| # | Route | Ai dùng | Nội dung chính |
|---|---|---|---|
| 1 | `/author/interview-questions` | Tác giả | Danh sách câu của tôi: lọc trạng thái/mức/chủ đề/từ khóa, badge trạng thái, nhãn “Có dùng AI”, ghi chú Moderator khi bị trả về, nút theo trạng thái (Sửa/Sao chép/Ẩn/Hiện lại/Xóa), phân trang |
| — | Hộp thoại “Tạo câu hỏi bằng AI” (mở từ trang 1) | Tác giả | Chủ đề, mức, số câu (1–5), yêu cầu, nội dung nguồn; hiện lượt AI còn lại; thành công thì tải lại danh sách, làm nổi bật bản nháp mới, báo “AI tạo được {n}/{count} câu…” |
| 2 | `/author/interview-questions/new` | Tác giả | Form: chủ đề, mức, câu hỏi, đáp án mẫu, gợi ý; xem trước Markdown; Lưu / Gửi duyệt |
| 3 | `/author/interview-questions/:id/edit` | Tác giả | Như trang 2 + Rút lại; câu đã công khai hoặc đang chờ duyệt thì chỉ đọc kèm thông báo; xung đột `version` có nút tải lại; rời trang khi chưa lưu thì hỏi |
| 4 | `/moderator/interview-questions` | Moderator | Danh sách theo chuẩn màn duyệt hiện có, mặc định “Chờ duyệt”, bộ lọc, nhãn “Có dùng AI”, cảnh báo tác giả không còn đủ điều kiện |
| 5 | `/moderator/interview-questions/:id` | Moderator | Xem câu hỏi, gợi ý, đáp án mẫu; Duyệt / Yêu cầu sửa; Ẩn / Khôi phục / Gỡ có hộp thoại nhập lý do; token lệch có nút tải lại |
| 6 | `/interview` | Người học (công khai) | Thẻ câu hỏi; lọc chủ đề/mức/từ khóa; đã đăng nhập thêm lọc “Đã lưu”/“Đã ôn” và nút lưu trên thẻ; phân trang; bộ lọc nằm trên URL |
| 7 | `/interview/:id` | Người học (công khai) | Câu hỏi, chủ đề, mức, tác giả; Guest thấy lời mời đăng nhập (giữ `returnTo`); đã đăng nhập: Xem gợi ý / Xem đáp án mẫu (chỉ gọi `/answer` ở lần bấm đầu), Đánh dấu đã ôn, Lưu lại; khối “Luyện trả lời” (đếm ký tự ≤ 4.000, nút “Nhận xét bằng AI”, lượt còn lại, kết quả mức đạt + ý tốt + ý thiếu + lời khuyên + lưu ý AI, “Thử lại” khi lỗi tạm thời, hết lượt thì khóa nút) |

Trang 6, 7 bọc `ReaderRoute` (ADMIN/MODERATOR bị chuyển về dashboard), không bọc `AuthRoute`. Thêm mục “Câu hỏi phỏng vấn” vào nhóm Tác giả của `Sidebar` và vào `ModeratorSidebar`, thêm “Ôn phỏng vấn” vào sidebar người dùng (trong `Sidebar.test.tsx` bỏ `interview` khỏi danh sách đường chết).

## 4. File được tạo / sửa (chỉ những file này)

Tạo:
- `app/src/types/interview.ts`
- `app/src/services/interviewService.ts` + `interviewService.test.ts`
- `app/src/data/interviewI18n.ts` + `interviewI18n.test.ts` (copy vi/en, ánh xạ mọi mã lỗi `INTERVIEW_*` liên quan, validation dùng chung)
- `app/src/pages/Author/InterviewQuestions/` (trang 1–3, hộp thoại AI, test từng trang)
- `app/src/pages/Moderator/InterviewQuestions/` (trang 4–5, test)
- `app/src/pages/Interview/` (trang 6–7, test)

Sửa:
- `app/src/App.tsx` (+ test App liên quan), `app/src/components/layout/{Sidebar,ModeratorSidebar}.tsx` (+ test), `app/src/data/{navigation,managementI18n}.ts`
- `app/src/services/aiAssistService.ts`, `app/src/types/aiAssist.ts` (+ test): quota thêm `interviewDraft`

## 5. Giao diện phải đẹp thế nào

- Trông như một sản phẩm học tập hiện đại, gọn và thoáng; cùng “giọng” với các trang Bài tập/Khóa học đang có, người dùng chuyển trang không thấy lạc tông. Không thêm màu mới; dùng token và primitive sẵn có, hoạt động tốt ở cả dark và light.
- Phân cấp rõ: câu hỏi là thứ nổi nhất; mức độ (Dễ/Vừa/Khó) và trạng thái là badge nhỏ có màu theo tone hiện có; chủ đề, tác giả là chữ phụ.
- Trang `/interview`: lưới thẻ (1 cột mobile, 2 cột tablet, 3 cột desktop rộng), thẻ có độ cao đều, câu hỏi cắt 3 dòng, hover nhẹ; thanh lọc gọn ở trên, mobile xếp dọc.
- Trang `/interview/:id`: cột đọc vừa phải (không tràn hết màn hình rộng); gợi ý và đáp án mẫu mở ra mượt (không giật bố cục); khối “Luyện trả lời” là một khung riêng nổi bật; kết quả AI có nhãn mức đạt nổi rõ (tốt/một phần/chưa đúng phân biệt bằng tone), ba nhóm ý trình bày dạng danh sách có biểu tượng, lưu ý AI ở chữ nhỏ.
- Trang soạn: form hai cột trên desktop (soạn bên trái, xem trước Markdown bên phải), một cột trên mobile; thanh hành động dính dưới đáy hoặc rõ ràng ở cuối form.
- Mọi trạng thái đều có giao diện tử tế: đang tải (skeleton, không chỉ chữ “Loading”), rỗng (`EmptyState` có lời mời hành động), lỗi (có nút thử lại), đang lưu/đang gọi AI (khóa nút, có spinner), chỉ đọc, Guest, hết lượt AI.
- Mobile 390px không cuộn ngang; vùng chạm tối thiểu 44px; focus bàn phím nhìn thấy được; ảnh/icon có nhãn truy cập.

## 6. Kiểm trước khi báo xong

- Viết test theo mục “Xong khi” của Task 2a và 2b trong spec (không assert class Tailwind; chuỗi dài dùng `user.paste`).
- Trong `app/`: chạy các file test bạn tạo/sửa (`npx vitest run <đường dẫn>`) và `npm run build`; cả hai phải đạt. Không cần chạy full `npm test`.
- Cuối câu trả lời liệt kê: file đã tạo/sửa, lệnh test + kết quả, những chỗ bạn làm khác spec và lý do, những gì chưa làm hoặc chưa kiểm, và mọi điểm backend có vẻ thiếu (không tự sửa).
